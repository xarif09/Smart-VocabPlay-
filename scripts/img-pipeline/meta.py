"""Batched Commons imageinfo lookups (licence, author, size) for candidates that came from REST search."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, COMMONS_API, api, h

META = os.path.join(CACHE, "meta")
os.makedirs(META, exist_ok=True)


def _path(t):
    return os.path.join(META, h(t) + ".json")


def ensure(titles):
    from fetch import IIPROPS
    need = sorted({t for t in titles if not os.path.exists(_path(t))})
    for i in range(0, len(need), 50):
        b = need[i:i + 50]
        j = api(COMMONS_API, dict(action="query", titles="|".join(b), **IIPROPS))
        if not j: continue
        q = j.get("query", {})
        back = {n["to"]: n["from"] for n in q.get("normalized", [])}
        got = set()
        for p in q.get("pages", []):
            t = back.get(p["title"], p["title"])
            info = p["imageinfo"][0] if p.get("imageinfo") and not p.get("missing") else None
            json.dump(info or {"missing": True}, open(_path(t), "w")); got.add(t)
        for t in b:
            if t not in got: json.dump({"missing": True}, open(_path(t), "w"))
        print(f"    meta {min(i + 50, len(need))}/{len(need)}", flush=True)


def complete(c):
    """Return candidate with licence/author/size, or None if not free / too small / unknown."""
    if c.get("license"): return c
    p = _path(c["title"])
    if not os.path.exists(p): return None
    info = json.load(open(p))
    if info.get("missing"): return None
    from fetch import to_cand
    full = to_cand(c["title"], info, c["origin"])
    if full is None: return None
    for k in ("local",):
        if k in c: full[k] = c[k]
    return full
