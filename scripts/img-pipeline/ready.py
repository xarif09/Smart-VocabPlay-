"""Print comma-separated keys whose candidates are fetched and thumbnails present (helper for incremental runs)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, h
import words as W
keep = set(json.load(open(os.path.join(CACHE, "keep_current.json")))) if os.path.exists(os.path.join(CACHE, "keep_current.json")) else set()
out = []
for w in W.load_words():
    f = os.path.join(CACHE, "cands", h(w["key"]) + ".json")
    if not os.path.exists(f): continue
    cs = json.load(open(f))
    if not cs or not (w["key"] in keep or any(c["origin"].startswith("search") for c in cs)): continue
    th = lambda c: os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg")
    if all(os.path.exists(th(c)) or os.path.exists(th(c) + ".fail") for c in cs):
        out.append(w["key"])
print(",".join(out))
