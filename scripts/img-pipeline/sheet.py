"""Contact sheets per category: 3:4 thumbnails with word labels (flagged words get a red label).
Usage: python sheet.py OUT_DIR [--cats a,b] [--cands cat|WORD]  (--cands shows ranked candidates of one word)
"""
import argparse, json, os, sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, HERE, CACHE, h
import words as W

TW, TH, LH, COLS = 150, 200, 30, 10


def font(sz):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def grid(items, out, title):
    """items: list of (image_path or None, label, red?)"""
    rows = (len(items) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * TW, rows * (TH + LH) + 30), "white")
    d = ImageDraw.Draw(sheet); f = font(12)
    d.text((5, 5), title, fill="black", font=font(16))
    for i, (p, label, red) in enumerate(items):
        x, y = (i % COLS) * TW, 30 + (i // COLS) * (TH + LH)
        if p and os.path.exists(p):
            im = Image.open(p).convert("RGB"); im.thumbnail((TW - 4, TH - 4))
            sheet.paste(im, (x + (TW - im.size[0]) // 2, y + (TH - im.size[1]) // 2))
        else:
            d.rectangle([x + 2, y + 2, x + TW - 2, y + TH - 2], outline="red")
        d.text((x + 3, y + TH + 2), label[:24], fill="red" if red else "black", font=f)
    sheet.save(out, quality=85)
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--cats"); ap.add_argument("--cands")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    if a.cands:
        sc = json.load(open(os.path.join(CACHE, "scores.json")))
        items = [(os.path.join(CACHE, "thumbs", h(s["title"]) + ".jpg"), f"{i} p{s['p']:.2f} {s['title'][5:20]}", False)
                 for i, s in enumerate(sorted(sc.get(a.cands, []), key=lambda s: -s["p"]))]
        print(grid(items, os.path.join(a.out, "cands_" + W.slug(a.cands) + ".jpg"), a.cands)); return
    wi = json.load(open(os.path.join(ROOT, "src", "wordImages.json")))
    rep = json.load(open(os.path.join(HERE, "report.json"))).get("words", {})
    by = {}
    for w in W.load_words(): by.setdefault(w["cat"], []).append(w)
    for cat, ws in by.items():
        if a.cats and cat not in a.cats.split(","): continue
        for part in range(0, len(ws), 60):
            items = []
            for w in ws[part:part + 60]:
                e = wi.get(w["key"]); r = rep.get(w["key"], {})
                items.append((os.path.join(ROOT, "public", "img", e["file"]) if e else None, w["word"], bool(r.get("flags") or r.get("status"))))
            print(grid(items, os.path.join(a.out, f"{cat}_{part // 60 + 1}.jpg"), f"{cat} {part + 1}-{part + len(items)}"))


if __name__ == "__main__":
    main()
