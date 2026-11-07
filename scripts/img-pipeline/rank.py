"""Stage 2: CLIP scoring of every downloaded candidate.

For each word the target class (its prompts) competes in a softmax against the other words of the same category,
hand-written hard negatives (wolf vs dog …) — giving p_word. Separate softmaxes give
p_photo (real photo vs drawing/map/logo/…), p_quality (bright single subject vs dark/cluttered) and p_unsafe.
Writes $IMG_CACHE/scores.json
"""
import argparse, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, h
import words as W
from spec import spec_for, GENERIC, GENERIC_SKIP, STYLE_NEG, PHOTO_POS, QUALITY_POS, QUALITY_NEG, UNSAFE, SAFE_REF

import models
MODEL = "ViT-L-14"
PRETRAINED = "laion400m_e32"   # weights from the open_clip GitHub release (HF CDN is not reachable here)
FEAT = os.path.join(CACHE, f"feat-{MODEL}-{PRETRAINED}")
os.makedirs(FEAT, exist_ok=True)

NO_WEAPON = {"jobs|SOLDIER", "jobs|POLICE", "jobs|PIRATE", "home|KNIFE", "toys|WATER GUN", "jobs|SECURITY GUARD", "sports|BAT",
             "sports|ARCHERY", "sports|FENCING"}
NO_BLOOD = {"body|BLOOD"}


class Clip:
    def __init__(self):
        import torch, open_clip
        torch.set_num_threads(os.cpu_count() or 4)
        self.torch = torch
        self.model, _, self.pre = open_clip.create_model_and_transforms(MODEL, pretrained=models.path("vit_l_14-laion400m_e32.pt"))
        self.model.eval()
        self.tok = open_clip.get_tokenizer(MODEL)
        self._t = {}
        tf = os.path.join(FEAT, "text.json")
        if os.path.exists(tf):
            self._t = {k: np.array(v, dtype=np.float32) for k, v in json.load(open(tf)).items()}

    def save_text(self):
        json.dump({k: v.tolist() for k, v in self._t.items()}, open(os.path.join(FEAT, "text.json"), "w"))

    def text(self, prompts):
        need = [p for p in prompts if p not in self._t]
        for i in range(0, len(need), 64):
            b = need[i:i + 64]
            with self.torch.no_grad():
                e = self.model.encode_text(self.tok(b)).float()
                e = e / e.norm(dim=-1, keepdim=True)
            for p, v in zip(b, e.numpy()): self._t[p] = v
        return np.stack([self._t[p] for p in prompts])

    def cls(self, prompts):
        e = self.text(prompts).mean(0)
        return e / np.linalg.norm(e)

    def images(self, paths):
        """paths -> features (cached per file)."""
        from PIL import Image
        out, todo = {}, []
        for p in paths:
            f = os.path.join(FEAT, os.path.basename(p) + ".npy")
            if os.path.exists(f): out[p] = np.load(f)
            else: todo.append(p)
        for i in range(0, len(todo), 32):
            b, ims = [], []
            for p in todo[i:i + 32]:
                try:
                    ims.append(self.pre(Image.open(p).convert("RGB"))); b.append(p)
                except Exception:
                    pass
            if not ims: continue
            with self.torch.no_grad():
                e = self.model.encode_image(self.torch.stack(ims)).float()
                e = e / e.norm(dim=-1, keepdim=True)
            for p, v in zip(b, e.numpy()):
                np.save(os.path.join(FEAT, os.path.basename(p) + ".npy"), v); out[p] = v
            if (i // 32) % 20 == 0: print(f"    img feats {i + len(b)}/{len(todo)}", flush=True)
        return out


def softmax(x, s=100.0):
    x = x * s; x = x - x.max(-1, keepdims=True); e = np.exp(x)
    return e / e.sum(-1, keepdims=True)


def main(words):
    clip = Clip()
    allw = W.load_words()
    specs = {w["key"]: spec_for(w) for w in allw}
    by_cat = {}
    for w in allw: by_cat.setdefault(w["cat"], []).append(w["key"])
    sf = os.path.join(CACHE, "scores.json")
    scores = json.load(open(sf)) if os.path.exists(sf) else {}
    photo_c = clip.cls(PHOTO_POS)
    q_pos = clip.cls([QUALITY_POS]); q_neg = clip.text(QUALITY_NEG)
    safe_c = clip.cls(SAFE_REF)
    generic_c = clip.cls(["a photo"])
    # 1) image features for all candidates
    cand = {}
    paths = []
    for w in words:
        f = os.path.join(CACHE, "cands", h(w["key"]) + ".json")
        cs = json.load(open(f, encoding="utf-8")) if os.path.exists(f) else []
        cs = [c for c in cs if os.path.exists(os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg"))]
        cand[w["key"]] = cs
        paths += [os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg") for c in cs]
    print("image features:", len(set(paths)), flush=True)
    feats = clip.images(sorted(set(paths)))
    # 2) per-word scoring
    for w in words:
        k = w["key"]; sp = specs[k]
        tgt = clip.cls(sp["prompts"])
        others = []
        for ok in by_cat[w["cat"]]:
            if ok == k or specs[ok]["word"] == sp["word"]: continue
            others.append(clip.cls(specs[ok]["prompts"]))
        for n in sp["neg"]: others.append(clip.cls([n]))
        for g, prompt in GENERIC.items():
            if g not in GENERIC_SKIP.get(w["cat"], set()): others.append(clip.cls([prompt]))
        classes = np.stack([tgt] + others)
        style = [s for s in STYLE_NEG if s not in sp["nostyle"] and not (sp["text_ok"] and s in ("text on a page", "a screenshot", "a scanned document"))]
        style_m = np.stack([photo_c] + [clip.cls([s]) for s in style])
        unsafe = [u for u in UNSAFE if not (k in NO_WEAPON and "weapon" in u) and not (k in NO_BLOOD and "blood" in u)]
        unsafe_m = np.stack([tgt, generic_c, safe_c] + [clip.cls([u]) for u in unsafe])  # on-topic images count as safe
        qual_m = np.vstack([q_pos[None], q_neg])
        res = []
        for c in cand[k]:
            v = feats.get(os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg"))
            if v is None: continue
            pw = float(softmax(classes @ v)[0])
            pp = float(softmax(style_m @ v)[0])
            pq = float(softmax(qual_m @ v)[0])
            pu = float(softmax(unsafe_m @ v)[3:].sum())
            cos = float(tgt @ v)
            res.append(dict(title=c["title"], p=round(pw, 4), photo=round(pp, 4), q=round(pq, 4), unsafe=round(pu, 4), cos=round(cos, 4)))
        scores[k] = res
    clip.save_text()
    json.dump(scores, open(sf, "w"), ensure_ascii=False)
    print("scored", len(words), "words", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--only"); ap.add_argument("--cats")
    a = ap.parse_args()
    ws = W.load_words()
    if a.only: ws = [w for w in ws if w["key"] in set(a.only.split(","))]
    if a.cats: ws = [w for w in ws if w["cat"] in set(a.cats.split(","))]
    main(ws)
