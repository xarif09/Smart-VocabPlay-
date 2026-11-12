"""Re-frame the word photos already in src/wordImages.json (v3.21 framing, see frame.py).

    python recrop.py [--cats a,b] [--only k1,k2] [--alts] [--force] [--detect-only]
    python recrop.py --old "cat|WORD,..."     add a word from its older photo (src/images.js -> public/img, credits.json)

For every word: subject box on the large source (YOLO + U2Net, cached in $IMG_CACHE/frame_det.json) -> 3:4 window
(frame.plan) -> public/img/w/<cat>__<slug>.jpg 600x800. With --alts, a word whose subject cannot fit
(or is cut by the source photo) tries its next CLIP-ranked candidates and switches only to one that frames well
and scores as well as the current choice. Progress/notes: scripts/img-pipeline/frame_report.json (resumable).
Overrides (overrides.json) honoured: box, mode, zoom (>1 = tighter), dx, dy (fraction of the frame), file.
"""
import argparse, json, os, sys
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, HERE, ROOT, LARGE_W, h, fetch_thumb
import words as W
import frame, meta
from spec import spec_for
from select_crop import Detector, save_jpeg, dump_json, load_json, pre_score, saturation, GRAY_OK, OUT_DIR, JSON_OUT, OUT_W, OUT_H

DET = os.path.join(CACHE, "frame_det.json")
FREP = os.path.join(HERE, "frame_report.json")
REJ = os.path.join(HERE, "rejected.json")
_det = [None]
dets = load_json(DET, {})


def detector():
    if _det[0] is None: _det[0] = Detector()
    return _det[0]


def raw_for(title, im, tag):
    k = h(title) + "|" + tag
    if k not in dets:
        dets[k] = frame.detect(detector(), im)
        if len(dets) % 25 == 0: dump_json(dets, DET)
    return dets[k]


def large(title, local=None):
    lp = os.path.join(CACHE, "large", h(title) + ".jpg")
    if not os.path.exists(lp) and title.startswith("File:"):
        fetch_thumb(title, LARGE_W, lp)
    if os.path.exists(lp):
        return ImageOps.exif_transpose(Image.open(lp)).convert("RGB")
    if local and os.path.exists(os.path.join(ROOT, local)):
        return ImageOps.exif_transpose(Image.open(os.path.join(ROOT, local))).convert("RGB")
    return None


def thumb(title):
    tp = os.path.join(CACHE, "thumbs", h(title) + ".jpg")
    try: return ImageOps.exif_transpose(Image.open(tp)).convert("RGB")
    except Exception: return None


def frame_image(im, raw, sp, ov, cat):
    Wd, Ht = im.size
    box, how, cen = frame.subject_box(raw, sp, ov, cat)
    pb = [box[0] * Wd, box[1] * Ht, box[2] * Wd, box[3] * Ht]
    mode = ov.get("mode") or sp["mode"]
    crop, info = frame.plan(Wd, Ht, pb, how, cen, mode, ov)
    if mode == "person" and not info.get("kind") and not info["fits"] and how.startswith("yolo"):
        # a group too wide for the frame: frame the main (largest) person instead
        box2, how2, _ = frame.subject_box(raw, sp, ov, cat, main_only=True)
        pb2 = [box2[0] * Wd, box2[1] * Ht, box2[2] * Wd, box2[3] * Ht]
        crop2, info2 = frame.plan(Wd, Ht, pb2, how2 + ":main", cen, mode, ov)
        if info2["fill"] < info["fill"]: box, crop, info = box2, crop2, info2
    info["box"] = [round(v, 3) for v in box]
    return crop, info


def needs_alt(info, sp):
    if info.get("kind"): return False
    if not info["fits"]: return True
    e = info.get("src_edges", "")
    if sp["mode"] == "person": return "T" in e
    return len(e) >= 1 and sp["mode"] == "object" and sp["cat"] in ("animals", "vehicles") or len(e) >= 2


def write(im, crop, path):
    img = im.crop(tuple(round(v) for v in crop)).resize((OUT_W, OUT_H), Image.LANCZOS)
    save_jpeg(img, path)


def main(a):
    out = load_json(JSON_OUT, {})
    rep = load_json(os.path.join(HERE, "report.json"), {"words": {}})["words"]
    ovs = load_json(os.path.join(HERE, "overrides.json"), {})
    scores = load_json(os.path.join(CACHE, "scores.json"), {})
    frep = load_json(FREP, {})
    rejected = set(load_json(REJ, []))
    words = {w["key"]: w for w in W.load_words()}
    keys = sorted(k for k in out if k in words)
    if a.cats: keys = [k for k in keys if k.split("|")[0] in set(a.cats.split(","))]
    if a.only: keys = [k for k in a.only.split(",") if k in words]
    used = {v.get("title"): k for k, v in frep.items() if v.get("title")}
    for k, v in rep.items():
        if k in out and v.get("title"): used.setdefault(v["title"], k)
    n = 0
    if a.alts:   # licence/author lookups for every plausible alternative, batched (the API is rate-limited)
        need = []
        for k in keys:
            sp = spec_for(words[k])
            cs = {c["title"]: c for c in load_json(os.path.join(CACHE, "cands", h(k) + ".json"), [])}
            ok = [s for s in scores.get(k, []) if s["title"] in cs and not cs[s["title"]].get("license")
                  and s["p"] >= 0.6 and s["photo"] >= 0.5 and s["unsafe"] <= 0.35]
            ok.sort(key=lambda s: -pre_score(s, sp["strict"], sp["word"] in GRAY_OK))
            need += [s["title"] for s in ok[:int(os.environ.get("ALT_EVAL", "14"))]]
        print("meta lookups:", len(need), flush=True)
        meta.ensure(need)
    for k in keys:
        if k in frep and frep[k].get("v") == 3 and not a.force and not a.only: continue
        w = words[k]; sp = spec_for(w); cat = w["cat"]
        ov = ovs.get(k) or {}
        if isinstance(ov, str): ov = {"file": ov}
        cands = {c["title"]: c for c in load_json(os.path.join(CACHE, "cands", h(k) + ".json"), [])}
        title = (frep.get(k) or {}).get("title") or rep.get(k, {}).get("title")
        if ov.get("file"):
            title = ov["file"] if ov["file"].startswith("File:") else "File:" + ov["file"]
        if not title:
            print("  no title", k); continue
        c = cands.get(title, {})
        im = large(title, c.get("local"))
        if im is None:
            print("  no image", k, title); continue
        raw = raw_for(title, im, "L")
        if a.detect_only:
            n += 1
            if n % 50 == 0: print(" ", n, k, flush=True)
            continue
        crop, info = frame_image(im, raw, sp, ov, cat)
        info["score"] = round(frame.score(info), 3)
        switched = None
        if a.alts and sp["mode"] == "object" and needs_alt(info, sp) and not ov.get("file") and not ov.get("box"):
            cur_s = next((s for s in scores.get(k, []) if s["title"] == title), None)
            cur_ps = pre_score(cur_s, sp["strict"], sp["word"] in GRAY_OK) if cur_s else 0.5
            excl = set(ov.get("exclude", []))
            alts = sorted([s for s in scores.get(k, []) if s["title"] != title and s["title"] in cands and s["title"] not in excl
                           and used.get(s["title"], k) == k], key=lambda s: -pre_score(s, sp["strict"], sp["word"] in GRAY_OK))
            pool = []
            for s in alts[:int(os.environ.get("ALT_EVAL", "14"))]:
                ps = pre_score(s, sp["strict"], sp["word"] in GRAY_OK)
                if ps < cur_ps - 0.15 or s["p"] < 0.6 or s["photo"] < 0.5 or s["unsafe"] > 0.35: continue
                if not (sp["word"] in GRAY_OK) and saturation(s["title"]) < 0.08: continue
                th = thumb(s["title"])
                if th is None: continue
                _, ti = frame_image(th, raw_for(s["title"], th, "T"), sp, ov, cat)
                fs = frame.score(ti)
                if ti.get("kind") == "full" or needs_alt(ti, sp) or fs < info["score"] + 0.2: continue
                pool.append((ps + 0.6 * fs, s))
            pool.sort(key=lambda x: -x[0])
            pool = pool[:int(os.environ.get("ALTS", "6"))]
            meta.ensure([s["title"] for _, s in pool if not cands[s["title"]].get("license")])
            for _, s in pool:
                cc = meta.complete(cands[s["title"]])
                if not cc or not cc.get("license"): continue
                ima = large(s["title"], cc.get("local"))
                if ima is None: continue
                cr2, i2 = frame_image(ima, raw_for(s["title"], ima, "L"), sp, ov, cat)
                i2["score"] = round(frame.score(i2), 3)
                if i2.get("kind") == "full" or needs_alt(i2, sp) or i2["score"] < info["score"] + 0.2: continue
                switched = dict(title=s["title"], c=cc, im=ima, crop=cr2, info=i2, prev=title); break
        if switched:
            title, c, im, crop, info = switched["title"], switched["c"], switched["im"], switched["crop"], switched["info"]
            info["switched_from"] = switched["prev"]
            out[k].update(src=c["src"], author=c["author"], license=c["license"])
            used[title] = k
        fn = W.out_name(cat, w["word"])
        if not a.dry:
            write(im, crop, os.path.join(OUT_DIR, fn))
            out[k]["file"] = "w/" + fn
        info.update(title=title, v=3, src_w=im.size[0], src_h=im.size[1])
        info["flag"] = flag_of(info, sp)
        frep[k] = info
        n += 1
        if n % 20 == 0:
            print(f"  {n} {k} {info.get('fill')} {info['flag']}", flush=True)
            if not a.dry: dump_json(out, JSON_OUT, indent=1)
            dump_json(frep, FREP, indent=1); dump_json(dets, DET)
    dump_json(dets, DET)
    if not a.dry: dump_json(out, JSON_OUT, indent=1)
    dump_json(frep, FREP, indent=1)
    print("done", n)


def add_old(a):
    """crop the older photo of each key (src/images.js -> credits.json / Commons original) into wordImages.json"""
    import re
    from common import licence_ok, strip_html
    out = load_json(JSON_OUT, {})
    ovs = load_json(os.path.join(HERE, "overrides.json"), {})
    frep = load_json(FREP, {})
    cm = W.load_current_mapping()
    cred = load_json(os.path.join(ROOT, "public", "img", "credits.json"), {})
    words = {w["key"]: w for w in W.load_words()}
    for k in a.old.split(","):
        if k not in cm or k not in words: print("  not an old-photo word", k); continue
        w = words[k]; sp = spec_for(w); ov = ovs.get(k) or {}
        if isinstance(ov, str): ov = {}
        cur = cm[k]; cf = cur["commons_file"]; cr = cred.get(cur["title"], {})
        lic = strip_html(cr.get("license", ""))
        if not cf or not licence_ok(lic): print("  no free licence", k, lic); continue
        im = large(cf, os.path.join("public", "img", cur["file"]) if cur.get("file") else None)
        if im is None: print("  no image", k); continue
        crop, info = frame_image(im, raw_for(cf, im, "L"), sp, ov, w["cat"])
        fn = W.out_name(w["cat"], w["word"])
        write(im, crop, os.path.join(OUT_DIR, fn))
        author = strip_html(cr.get("artist", "")) or "Wikimedia Commons"
        out[k] = {"file": "w/" + fn, "src": "https://commons.wikimedia.org/wiki/" + cf.replace(" ", "_"),
                  "author": author[:200], "license": lic, "score": 0.6}
        info.update(title=cf, v=3, src_w=im.size[0], src_h=im.size[1], origin="old")
        info["score"] = round(frame.score(info), 3); info["flag"] = flag_of(info, sp)
        frep[k] = info
        print(" ", k, im.size, info.get("fill"), info["flag"], flush=True)
    dump_json(dets, DET)
    dump_json({k: out[k] for k in sorted(out)}, JSON_OUT, indent=1)
    dump_json(frep, FREP, indent=1)


def flag_of(info, sp):
    f = []
    if info.get("kind"): return ""
    if not info["fits"]: f.append(f"cannot fit (fill {info['fill']})")
    elif info["tight"]: f.append("tight")
    if info["loose"]: f.append("small")
    if info.get("cut"): f.append("cut " + info["cut"])
    if info.get("src_edges"): f.append("source edge " + info["src_edges"])
    return ", ".join(f)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cats"); ap.add_argument("--only"); ap.add_argument("--alts", action="store_true")
    ap.add_argument("--force", action="store_true"); ap.add_argument("--detect-only", action="store_true")
    ap.add_argument("--dry", action="store_true"); ap.add_argument("--old")
    a = ap.parse_args()
    add_old(a) if a.old else main(a)
