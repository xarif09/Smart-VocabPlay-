"""Model weights (all from GitHub releases; downloaded once into $IMG_MODELS)."""
import os, subprocess
from common import HERE

MODELS = os.environ.get("IMG_MODELS", os.path.join(HERE, ".models"))
URLS = {
    "vit_l_14-laion400m_e32.pt": "https://github.com/mlfoundations/open_clip/releases/download/v0.2-weights/vit_l_14-laion400m_e32-3d133497.pt",
    "yolov8m.pt": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8m.pt",
    "u2net.onnx": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
}


def path(name):
    os.makedirs(MODELS, exist_ok=True)
    p = os.path.join(MODELS, name)
    if not os.path.exists(p):
        print("downloading", name, flush=True)
        subprocess.check_call(["curl", "-sSL", "-o", p + ".part", URLS[name]])
        os.replace(p + ".part", p)
    return p
