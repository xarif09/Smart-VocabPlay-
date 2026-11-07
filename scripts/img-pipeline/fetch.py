"""Stage 1: gather freely-licensed photo candidates per word (Wikipedia + Commons) and download small thumbnails.

Usage: python fetch.py [--only cat|WORD,...] [--cats animals,fruits]
Writes  $IMG_CACHE/cands/<sha1(key)>.json  (list of candidate dicts) and $IMG_CACHE/thumbs/<sha1(title)>.jpg
"""
import argparse, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import words as W
from spec import spec_for

IIPROPS = dict(prop="imageinfo", iiprop="url|size|mime|extmetadata", iiurlwidth=str(SMALL_W),
               iiextmetadatafilter="LicenseShortName|Artist|UsageTerms|Credit|ObjectName|Restrictions")
BAD_NAME = re.compile(r"(icon|logo|map|flag of|symbol|commons-|wikipedia|wiktionary|edit-|question|stub|diagram|chart|"
                      r"distribution|locator|range|signature|coat of arms|seal of|emblem|\.svg|\.gif|\.webm|\.ogv|\.ogg|\.pdf|\.djvu|\.tif)", re.I)
OK_MIME = {"image/jpeg", "image/png", "image/webp"}


def load_overrides():
    p = os.path.join(HERE, "overrides.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


def wiki_pages(titles):
    """title -> list of file titles (pageimage first). Follows redirects."""
    out = {}
    titles = sorted(set(t for t in titles if t))
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        params = dict(action="query", titles="|".join(batch), redirects="1", prop="pageimages", piprop="name")
        pages, redir, norm = {}, {}, {}
        cont = {}
        while True:
            j = api(WIKI_API, {**params, **cont})
            q = j.get("query", {})
            for n in q.get("normalized", []): norm[n["from"]] = n["to"]
            for r in q.get("redirects", []): redir[r["from"]] = r["to"]
            for p in q.get("pages", []):
                d = pages.setdefault(p["title"], dict(pi=None, imgs=[]))
                if p.get("pageimage"): d["pi"] = "File:" + p["pageimage"].replace("_", " ")
                for im in p.get("images", []): d["imgs"].append(im["title"])
            if "continue" in j:
                cont = {k: v for k, v in j["continue"].items()}
            else:
                break
        for t in batch:
            tt = norm.get(t, t); tt = redir.get(tt, tt)
            d = pages.get(tt)
            if not d: continue
            files = ([d["pi"]] if d["pi"] else []) + [f for f in d["imgs"] if f != d["pi"]]
            out[t] = [f for f in files if not BAD_NAME.search(f)]
    return out


def file_infos(file_titles):
    """File:title -> imageinfo dict (from Commons; files not on Commons are absent)."""
    res = {}
    ft = sorted(set(file_titles))
    for i in range(0, len(ft), 50):
        j = api(COMMONS_API, dict(action="query", titles="|".join(ft[i:i + 50]), **IIPROPS))
        q = j.get("query", {})
        norm = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for p in q.get("pages", []):
            if p.get("missing") or not p.get("imageinfo"): continue
            res[p["title"]] = p["imageinfo"][0]
            if p["title"] in norm: res[norm[p["title"]]] = p["imageinfo"][0]
    return res


def commons_search(query, limit=15):
    """Commons file search. Uses an already-cached generator=search result (has licence info) if present,
    otherwise the REST search endpoint (titles only; licence/author are looked up later, batched, for finalists)."""
    params = dict(action="query", generator="search", gsrsearch=f"{query} filetype:bitmap", gsrnamespace="6",
                  gsrlimit=str(limit), **IIPROPS)
    if api(COMMONS_API, params, cache_only=True) is None:
        j = api(COMMONS_REST_SEARCH, dict(q=f"{query} filetype:bitmap", limit=str(limit)))
        return [(p["title"], None) for p in j.get("pages", []) if p.get("title", "").startswith("File:")]
    j = api(COMMONS_API, dict(action="query", generator="search", gsrsearch=f"{query} filetype:bitmap", gsrnamespace="6",
                              gsrlimit=str(limit), **IIPROPS))
    pages = j.get("query", {}).get("pages", [])
    pages.sort(key=lambda p: p.get("index", 0))
    return [(p["title"], p["imageinfo"][0]) for p in pages if p.get("imageinfo")]


def lite_cand(title, origin):
    """candidate without metadata yet (licence/author/size filled in later by meta.py)"""
    if BAD_NAME.search(title) or not re.search(r"\.(jpe?g|png|webp)$", title, re.I): return None
    return dict(title=title, origin=origin, src="https://commons.wikimedia.org/wiki/" + title.replace(" ", "_"))


def to_cand(title, info, origin):
    if BAD_NAME.search(title): return None
    if info.get("mime") not in OK_MIME: return None
    w, hgt = info.get("width") or 0, info.get("height") or 0
    if w < 500 or hgt < 500 or max(w, hgt) / max(1, min(w, hgt)) > 2.6: return None
    em = info.get("extmetadata", {})
    lic = strip_html(em.get("LicenseShortName", {}).get("value", ""))
    if not licence_ok(lic): return None
    author = strip_html(em.get("Artist", {}).get("value", "")) or strip_html(em.get("Credit", {}).get("value", ""))
    return dict(title=title, origin=origin, w=w, h=hgt, license=lic, author=author[:200],
                src=info.get("descriptionurl") or ("https://commons.wikimedia.org/wiki/" + title.replace(" ", "_")),
                small=thumb_url(info, SMALL_W), large=thumb_url(info, LARGE_W))


EXEC = None
MAX_CANDS = int(os.environ.get("MAX_CANDS", "7"))


def cap(cands, n):
    head = [c for c in cands if c["origin"] in ("override", "current")]
    wiki = [c for c in cands if c["origin"].startswith("wiki:")]
    groups = {}
    for c in cands:
        if c["origin"].startswith("search:"): groups.setdefault(c["origin"], []).append(c)
    out = head + wiki[:3]
    lists = list(groups.values()) + [wiki[3:]]
    i = 0
    while len(out) < n and any(i < len(l) for l in lists):
        for l in lists:
            if i < len(l) and len(out) < n: out.append(l[i])
        i += 1
    return out


ABSTRACT = {"colors", "numbers", "shapes", "feelings", "opposites", "time", "actions", "family", "jobs"}


def load_keep():
    p = os.path.join(CACHE, "keep_current.json")
    return set(json.load(open(p))) if os.path.exists(p) else set()


def gather(words, overrides, cur, current_only=False):
    keep = load_keep()
    # 1) Wikipedia article media
    art = {}
    for w in words:
        t = []
        if w["key"] in cur: t.append(cur[w["key"]]["title"])
        plain = w["word"].lower().capitalize()
        t.append(plain)
        art[w["key"]] = t
    print("wikipedia articles…", flush=True)
    wp = {} if (current_only or os.environ.get("WIKI", "0") != "1") else wiki_pages([t for k, ts in art.items() if k not in keep for t in ts])
    # 2) file infos for wiki files + current photo + override files
    need = set()
    for w in words:
        for t in art[w["key"]]:
            need.update(wp.get(t, [])[:12])
        c = cur.get(w["key"])
        if c and c.get("commons_file"): need.add(c["commons_file"])
        ov = overrides.get(w["key"])
        ovf = ov if isinstance(ov, str) else (ov or {}).get("file")
        if ovf: need.add(ovf if ovf.startswith("File:") else "File:" + ovf)
    print("file infos for", len(need), "files…", flush=True)
    infos = file_infos(need)
    # 3) commons searches per word
    allc = {}
    for n, w in enumerate(words):
        sp = spec_for(w)
        ov = overrides.get(w["key"])
        extra_q = (ov or {}).get("queries", []) if isinstance(ov, dict) else []
        cands, seen = [], set()

        def add(title, info, origin):
            if title in seen: return
            c = to_cand(title, info, origin) if info else lite_cand(title, origin)
            if c: seen.add(title); cands.append(c)

        ovf = ov if isinstance(ov, str) else (ov or {}).get("file")
        if ovf:
            ovf = ovf if ovf.startswith("File:") else "File:" + ovf
            if ovf in infos:
                c = to_cand(ovf, infos[ovf], "override")
                if c is None:  # allow override even if size filter fails, but keep licence check
                    em = infos[ovf].get("extmetadata", {})
                    print("  override rejected (licence/size):", w["key"], ovf)
                else:
                    seen.add(ovf); cands.append(c)
        c = cur.get(w["key"])
        if c and c.get("commons_file"):
            add(c["commons_file"], infos.get(c["commons_file"]), "current")
            lp = os.path.join(ROOT, "public", "img", c.get("file") or "")
            if cands and cands[-1]["title"] == c["commons_file"] and c.get("file") and os.path.exists(lp):
                cands[-1]["local"] = os.path.relpath(lp, ROOT)   # already in the repo: no download needed
        skip = current_only or (w["key"] in keep and not extra_q and not ovf)
        for t in ([] if skip else art[w["key"]]):
            for f in wp.get(t, [])[:12]: add(f, infos.get(f), "wiki:" + t)
        nq = 0 if skip else (2 if w["cat"] in ABSTRACT else 1)
        for qi, q in enumerate((extra_q + sp["queries"])[:nq + len(extra_q)]):
            for f, info in commons_search(q, 20): add(f, info, "search:" + q)
        # cap: keep override/current/wiki lead images, then interleave search results across queries
        cands = cap(cands, MAX_CANDS)
        allc[w["key"]] = cands
        if EXEC is not None:
            for c in cands:
                EXEC.submit(ensure_thumb, c)
        json.dump(cands, open(os.path.join(CACHE, "cands", h(w["key"]) + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
        if n % 25 == 0: print(f"  {n}/{len(words)} {w['key']}: {len(cands)} cands", flush=True)
    return allc


def ensure_thumb(c):
    dst = os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg")
    if c.get("local") and not os.path.exists(dst):
        try:
            from PIL import Image
            im = Image.open(os.path.join(ROOT, c["local"])).convert("RGB")
            im.thumbnail((SMALL_W, SMALL_W * 4)); im.save(dst, quality=90)
            return True
        except Exception:
            pass
    return fetch_thumb(c["title"], SMALL_W, dst)


def download_thumbs(allc):
    jobs = {}
    for cands in allc.values():
        for c in cands:
            jobs[c["title"]] = c["small"]
    print("thumbs to ensure:", len(jobs), flush=True)

    allcand = {c["title"]: c for cands in allc.values() for c in cands}
    with ThreadPoolExecutor(2) as ex:
        ok = sum(1 for r in ex.map(ensure_thumb, allcand.values()) if r)
    print("thumbs ok:", ok, "/", len(jobs), flush=True)


def select_words(args):
    words = W.load_words()
    if args.only: words = [w for w in words if w["key"] in set(args.only.split(","))]
    if args.cats: words = [w for w in words if w["cat"] in set(args.cats.split(","))]
    return words


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only"); ap.add_argument("--cats")
    ap.add_argument("--current-only", action="store_true", help="only the photo already used by the app (pre-check)")
    args = ap.parse_args()
    words = select_words(args)
    EXEC = ThreadPoolExecutor(2)   # thumbnails download while the searches continue (separate throttle)
    allc = gather(words, load_overrides(), W.load_current_mapping(), args.current_only)
    EXEC.shutdown(wait=True)
    download_thumbs(allc)          # retry pass / report
