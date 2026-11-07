"""Hand-pick a candidate: python pick.py "cat|WORD=3" ...  (index as shown on the sheet.py --cands sheet) -> overrides.json"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, HERE, h
p = os.path.join(HERE, "overrides.json")
ov = json.load(open(p, encoding="utf-8"))
for a in sys.argv[1:]:
    k, i = a.rsplit("=", 1)
    cs = json.load(open(os.path.join(CACHE, "cands", h(k) + ".json"), encoding="utf-8"))
    e = ov.get(k) if isinstance(ov.get(k), dict) else {}
    e["file"] = cs[int(i)]["title"]
    ov[k] = e
    print(k, "->", e["file"])
json.dump(ov, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
