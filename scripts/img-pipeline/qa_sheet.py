"""Contact sheets of the FINAL word photos (what the app really shows) for visual QA.

    python3 scripts/img-pipeline/qa_sheet.py OUT_DIR [cat1,cat2,...]

Reads src/wordImages.json + public/img/w/*.jpg, writes OUT_DIR/<cat>_<n>.jpg (50 photos per sheet,
10 columns, word under each photo). Run from the repo root. Needs only Pillow.
"""
import json, os, sys
from PIL import Image, ImageDraw

out = sys.argv[1]
only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
os.makedirs(out, exist_ok=True)
data = json.load(open("src/wordImages.json"))
cats = {}
for key, e in sorted(data.items()):
    cat, word = key.split("|", 1)
    if only and cat not in only:
        continue
    cats.setdefault(cat, []).append((word, e["file"]))

W, H, COLS, PER = 120, 160, 10, 50
for cat, items in cats.items():
    for start in range(0, len(items), PER):
        chunk = items[start:start + PER]
        rows = (len(chunk) + COLS - 1) // COLS
        sheet = Image.new("RGB", (COLS * W, rows * (H + 16)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, (word, f) in enumerate(chunk):
            x, y = (i % COLS) * W, (i // COLS) * (H + 16)
            try:
                im = Image.open(os.path.join("public/img", f)).convert("RGB").resize((W - 4, H - 4))
                sheet.paste(im, (x + 2, y + 2))
            except OSError:
                draw.rectangle([x + 2, y + 2, x + W - 2, y + H - 2], outline="red")
            draw.text((x + 3, y + H), word[:18], fill="black")
        path = os.path.join(out, f"{cat}_{start // PER + 1}.jpg")
        sheet.save(path, quality=80)
        print(path)
