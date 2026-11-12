"""More candidates for words whose photo cannot be framed 3:4 without cutting the subject (v3.21).

    python research.py --only "cat|WORD,..." [--q "template {w}", ...]

Runs extra Commons searches (REST search, titles only) with framing-friendly queries — single object on a plain
background, quality images, front views — appends the new candidates to $IMG_CACHE/cands/<key>.json (existing
ones are kept) and downloads their thumbnails. Then run:  rank.py --only ...  and  recrop.py --alts --only ...
"""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, COMMONS_REST_SEARCH, api, h, SMALL_W, fetch_thumb
from fetch import BAD_NAME
import words as W

# one query per word by default: Commons rate-limits the search API hard (Retry-After up to ~50 s)
OBJ = ["{w} white background"]
TEMPLATES = {"animals": ["{w} animal"], "vehicles": ["{w} front view"], "food": ["{w} on a plate"]}
NOUN = {"BIKE": "bicycle", "JET": "jet aircraft", "PLANE": "airliner", "TV": "television", "SKYTRAIN": "BTS Skytrain"}


def main(a):
    words = {w["key"]: w for w in W.load_words()}
    for k in a.only.split(","):
        w = words.get(k)
        if not w: continue
        word = NOUN.get(w["word"], w["word"].lower())
        qs = a.q or TEMPLATES.get(w["cat"], OBJ)
        cf = os.path.join(CACHE, "cands", h(k) + ".json")
        cands = json.load(open(cf, encoding="utf-8")) if os.path.exists(cf) else []
        seen = {c["title"] for c in cands}
        new = 0
        for q in qs:
            qq = q.format(w=word)
            j = api(COMMONS_REST_SEARCH, dict(q=f"{qq} filetype:bitmap", limit=str(a.limit)))
            for p in (j or {}).get("pages", []):
                t = p.get("title", "")
                if not t.startswith("File:") or t in seen or BAD_NAME.search(t) or not re.search(r"\.(jpe?g|png|webp)$", t, re.I):
                    continue
                seen.add(t); new += 1
                cands.append(dict(title=t, origin="search2:" + qq, src="https://commons.wikimedia.org/wiki/" + t.replace(" ", "_")))
        tmp = cf + ".tmp"
        json.dump(cands, open(tmp, "w", encoding="utf-8"), ensure_ascii=False); os.replace(tmp, cf)
        ok = 0
        for c in cands:
            if fetch_thumb(c["title"], SMALL_W, os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg")): ok += 1
        print(f"  {k}: +{new} candidates ({len(cands)} total, {ok} thumbs)", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--only", required=True); ap.add_argument("--q", action="append")
    ap.add_argument("--limit", type=int, default=40)
    main(ap.parse_args())
