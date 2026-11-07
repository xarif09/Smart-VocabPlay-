"""Smart VocabPlay word-photo pipeline (3:4 portrait, subject fully in frame).

Setup (CPU only):
    python3 -m venv /path/venv && /path/venv/bin/pip install -r scripts/img-pipeline/requirements.txt
Run everything (cached; reruns only do new work):
    IMG_CACHE=/path/cache IMG_MODELS=/path/models /path/venv/bin/python scripts/img-pipeline/run.py [--only cat|WORD,..] [--cats a,b]
Stages (can be run individually with the same --only/--cats flags):
    fetch.py        candidates from Wikipedia lead images + Commons file search (free licences only) -> thumbnails
    rank.py         CLIP ViT-L/14 scoring vs category distractors / look-alikes / style + safety negatives
    select_crop.py  YOLOv8 / U2Net subject box -> 3:4 crop with margin -> public/img/w/*.jpg, src/wordImages.json, report.json
    sheet.py OUT    contact sheets per category for visual QA (sheet.py OUT --cands "cat|WORD" shows all candidates)
Fix a word: edit overrides.json, e.g.
    "animals|DOG": "File:Some file.jpg"                      force a Commons file (fetched as candidate automatically)
    "animals|DOG": {"file": "...", "zoom": 1.2, "dx": 0, "dy": -0.05}   crop tweak (zoom>1 tighter; dx/dy shift as crop fraction)
    "animals|DOG": {"queries": ["beagle dog"], "exclude": ["File:Bad.jpg"]}   extra searches / ban candidates
    "animals|DOG": {"box": [x0,y0,x1,y1]}  subject box in relative coords;  {"mode": "scene"} use whole image
then rerun:  run.py --only "animals|DOG"
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
for st in ("fetch.py", "rank.py", "select_crop.py"):
    print("==", st, flush=True)
    subprocess.check_call([sys.executable, os.path.join(HERE, st)] + args)
