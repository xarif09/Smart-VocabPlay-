"""Stage 3+4+5: pick the best candidate per word, find the subject box, crop to 3:4 portrait, write outputs.

  final = 0.50*p_word + 0.20*p_photo + 0.10*p_quality + 0.10*cos_norm + 0.50*fit  - unsafe penalty
Outputs: public/img/w/<cat>__<slug>.jpg (600x800), src/wordImages.json, scripts/img-pipeline/report.json
Usage: python select_crop.py [--only k1,k2] [--cats c1,c2] [--top 4]
"""
import argparse, io, json, os, sys
import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, HERE, ROOT, LARGE_W, h, fetch_thumb
import words as W
import models, meta
from spec import spec_for

OUT_DIR = os.path.join(ROOT, "public", "img", "w")
JSON_OUT = os.path.join(ROOT, "src", "wordImages.json")
REPORT = os.path.join(HERE, "report.json")
OUT_W, OUT_H = 600, 800
MARGIN = 0.15
QUALITY = int(os.environ.get("JPEG_Q", "76"))
os.makedirs(OUT_DIR, exist_ok=True)
BOXES = os.path.join(CACHE, "boxes.json")


class Detector:
    def __init__(self):
        from ultralytics import YOLO
        self.yolo = YOLO(models.path("yolov8m.pt"))
        self.names = self.yolo.names
        os.environ.setdefault("U2NET_HOME", models.MODELS)
        models.path("u2net.onnx")
        from rembg import new_session
        self.sal = new_session("u2net")

    def yolo_boxes(self, im):
        r = self.yolo.predict(im, imgsz=640, conf=0.25, verbose=False)[0]
        out = []
        for b, c, s in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist()):
            out.append((self.names[int(c)].replace(" ", "_"), float(s), b))
        return out

    def saliency(self, im):
        m = self.sal.predict(im)[0].convert("L").resize(im.size)
        return np.asarray(m, dtype=np.float32) / 255.0


def mask_box(m, thr=0.5):
    """bbox of salient pixels, ignoring thin specks (rows/cols with < 1.5% salient)."""
    b = m > thr
    if b.mean() < 0.005: return None, 0.0
    H, W = b.shape
    rows = np.where(b.sum(1) > 0.015 * W)[0]; cols = np.where(b.sum(0) > 0.015 * H)[0]
    if len(rows) == 0 or len(cols) == 0: return None, 0.0
    return [float(cols[0]), float(rows[0]), float(cols[-1] + 1), float(rows[-1] + 1)], float(b.mean())


def union(bs):
    return [min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)]


def subject(det, im, sp, ov):
    """Return (box, how, saliency_centre) in image pixel coords."""
    W_, H_ = im.size
    if ov.get("box"):
        x0, y0, x1, y1 = ov["box"]; return [x0 * W_, y0 * H_, x1 * W_, y1 * H_], "override", None
    mode = ov.get("mode") or sp["mode"]
    if mode == "scene":
        m = det.saliency(im)
        if m.sum() > 1:
            ys, xs = np.mgrid[0:H_, 0:W_]
            c = (float((xs * m).sum() / m.sum()), float((ys * m).sum() / m.sum()))
        else:
            c = (W_ / 2, H_ / 2)
        return [0, 0, W_, H_], "scene", c
    if sp["coco"]:
        ds = [d for d in det.yolo_boxes(im) if d[0] == sp["coco"]]
        if ds:
            area = lambda b: (b[2] - b[0]) * (b[3] - b[1])
            big = max(area(d[2]) for d in ds)
            keep = [d[2] for d in ds if area(d[2]) >= 0.3 * big]
            return union(keep), "yolo:" + sp["coco"], None
    m = det.saliency(im)
    b, frac = mask_box(m)
    if b is None:
        return [0, 0, W_, H_], "none", None
    return b, "saliency", None


def plan_crop(W_, H_, box, how, centre=None, edge_pen=0.82):
    """3:4 crop containing box + margin. Returns (crop[x0,y0,x1,y1], fit in 0..1, notes)."""
    notes = []
    cwmax = min(W_, H_ * 0.75)
    if how == "scene":
        cw = cwmax; ch = cw * 4 / 3
        cx, cy = centre or (W_ / 2, H_ / 2)
        cx = W_ / 2 + 0.6 * (cx - W_ / 2); cy = H_ / 2 + 0.6 * (cy - H_ / 2)
        x0 = min(max(cx - cw / 2, 0), W_ - cw); y0 = min(max(cy - ch / 2, 0), H_ - ch)
        return [x0, y0, x0 + cw, y0 + ch], 1.0, notes
    x0, y0, x1, y1 = box
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    fit = 1.0
    # truncated subject in the source photo (touches the frame)
    edge = 0
    for v, lim in ((x0, 0), (y0, 0), (W_ - x1, 0), (H_ - y1, 0)):
        if v <= 0.012 * max(W_, H_): edge += 1
    if how != "none" and edge:
        notes.append(f"touches {edge} edge(s)"); fit *= edge_pen ** edge
    if how == "none":
        notes.append("no subject found"); fit *= 0.7
    if bw * bh < 0.03 * W_ * H_:
        notes.append("tiny subject"); fit *= 0.75
    rx0, ry0, rx1, ry1 = x0 - MARGIN * bw, y0 - MARGIN * bh, x1 + MARGIN * bw, y1 + MARGIN * bh
    rx0, ry0, rx1, ry1 = max(0, rx0), max(0, ry0), min(W_, rx1), min(H_, ry1)
    need = max(rx1 - rx0, (ry1 - ry0) * 0.75)
    cw = min(cwmax, max(need, min(cwmax, 0.42 * W_ if W_ > H_ else 0.6 * W_)))  # don't zoom in extremely
    ch = cw * 4 / 3
    if need > cwmax + 1:
        # subject + margin cannot fit: keep as much of the subject box as possible
        cov_w = min(1.0, cwmax / max(1, rx1 - rx0)); cov_h = min(1.0, (cwmax * 4 / 3) / max(1, ry1 - ry0))
        bcov = min(1.0, cwmax / bw) * min(1.0, (cwmax * 4 / 3) / bh)
        fit *= (0.45 + 0.4 * cov_w * cov_h) if bcov >= 0.999 else 0.6 * bcov
        notes.append(f"subject cannot fit 3:4 (box cov {bcov:.2f})")
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    X0 = min(max(cx - cw / 2, 0), W_ - cw); Y0 = min(max(cy - ch / 2, 0), H_ - ch)
    return [X0, Y0, X0 + cw, Y0 + ch], fit, notes


def save_jpeg(img, path, target=int(os.environ.get("JPEG_TARGET_KB", "45")) * 1024):
    """progressive JPEG; lower quality step by step (min 60) until under the size target."""
    q = QUALITY
    while True:
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= target or q <= 48: break
        q -= 4
    open(path, "wb").write(buf.getvalue())


def cos_norm(c):
    return float(min(1, max(0, (c - 0.15) / 0.15)))


_sat = {}


def saturation(title):
    """mean HSV saturation of the thumbnail (0 = black & white)"""
    if title not in _sat:
        try:
            im = Image.open(os.path.join(CACHE, "thumbs", h(title) + ".jpg")).convert("HSV").resize((64, 64))
            _sat[title] = float(np.asarray(im)[:, :, 1].mean() / 255.0)
        except Exception:
            _sat[title] = 0.3
    return _sat[title]


def pre_score(s, strict, gray_ok=False):
    pen = max(0.0, s["unsafe"] - 0.3) / 0.7 * (0.8 if strict else 0.5)
    if s["photo"] < 0.4: pen += 0.3 * (0.4 - s["photo"]) / 0.4 + 0.1      # drawings, paintings, statues, posters
    if not gray_ok and saturation(s["title"]) < 0.07: pen += 0.25          # black-and-white / sepia photos
    return 0.50 * s["p"] + 0.20 * s["photo"] + 0.10 * s["q"] + 0.10 * cos_norm(s["cos"]) - pen


def dump_json(obj, path, **kw):
    """atomic write (survives a container restart mid-write)"""
    tmp = path + ".tmp"
    json.dump(obj, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, **kw)
    os.replace(tmp, path)


def load_json(p, d):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d


GRAY_OK = {"BLACK", "WHITE", "GRAY", "BLACK AND WHITE", "SILVER", "LIGHT GRAY", "DARK GRAY", "CHARCOAL", "ZEBRA", "PANDA", "FOG", "FOGGY", "MIST", "SNOW", "SNOWY"}
DRY = False
META_ONLY = False
pre = {}


def main(words, top):
    det = None if META_ONLY else Detector()
    scores = load_json(os.path.join(CACHE, "scores.json"), {})
    overrides = load_json(os.path.join(HERE, "overrides.json"), {})
    boxes = load_json(BOXES, {})
    out = load_json(JSON_OUT, {})
    report = load_json(REPORT, {"words": {}})
    # licence/author/size for the top candidates of every word, batched 50 titles per API call
    need = []
    for w in words:
        sp = spec_for(w)
        cands = {c["title"]: c for c in load_json(os.path.join(CACHE, "cands", h(w["key"]) + ".json"), [])}
        sc = sorted([s for s in scores.get(w["key"], []) if s["title"] in cands], key=lambda s: -pre_score(s, sp["strict"], sp["word"] in GRAY_OK))
        need += [s["title"] for s in sc[:top + 2] if not cands[s["title"]].get("license")]
    meta.ensure(need)
    if META_ONLY: return
    used = {v["title"]: kk for kk, v in report["words"].items() if kk in out and v.get("title")}
    for n, w in enumerate(words):
        k = w["key"]; sp = spec_for(w)
        ov = overrides.get(k) or {}
        if isinstance(ov, str): ov = {"file": ov}
        cf = os.path.join(CACHE, "cands", h(k) + ".json")
        cands = {}
        for c in load_json(cf, []):
            c = meta.complete(c)
            if c: cands[c["title"]] = c
        sc = [s for s in scores.get(k, []) if s["title"] in cands]
        if ov.get("exclude"): sc = [s for s in sc if s["title"] not in set(ov["exclude"])]
        # one photo per word: skip photos already used by another word
        ovf_t = ("File:" + ov["file"] if ov.get("file") and not ov["file"].startswith("File:") else ov.get("file"))
        sc = [s for s in sc if used.get(s["title"], k) == k or s["title"] == ovf_t]
        if not sc:
            report["words"][k] = {"status": "no candidates"}; out.pop(k, None); continue
        forced = None
        if ov.get("file"):
            ft = ov["file"] if ov["file"].startswith("File:") else "File:" + ov["file"]
            forced = next((s for s in sc if s["title"] == ft), None)
            if forced is None: print("  override file not among candidates:", k, ft)
        ranked = sorted(sc, key=lambda s: -pre_score(s, sp["strict"], sp["word"] in GRAY_OK))
        finals = [forced] if forced else ranked[:top]
        best = None
        for s in finals:
            c = cands[s["title"]]
            tp = os.path.join(CACHE, "thumbs", h(c["title"]) + ".jpg")
            try:
                ims = ImageOps.exif_transpose(Image.open(tp)).convert("RGB")
            except Exception:
                continue
            tw, th = ims.size
            bk = h(c["title"]) + "|" + sp["mode"] + "|" + str(sp["coco"]) + "|" + json.dumps(ov.get("box")) + str(ov.get("mode"))
            if bk not in boxes:
                box, how, centre = subject(det, ims, sp, ov)   # detection on the small thumbnail
                boxes[bk] = [[box[0] / tw, box[1] / th, box[2] / tw, box[3] / th], how, [centre[0] / tw, centre[1] / th] if centre else None]
            rbox, how, rcen = boxes[bk]
            # plan in the large image's pixel space (width = min(original, LARGE_W))
            Lw = min(c["w"], LARGE_W) if not c.get("local") else max(min(c["w"], LARGE_W), 1)
            Lh = Lw * th / tw
            box = [rbox[0] * Lw, rbox[1] * Lh, rbox[2] * Lw, rbox[3] * Lh]
            crop, fit, notes = plan_crop(Lw, Lh, box, how, (rcen[0] * Lw, rcen[1] * Lh) if rcen else None,
                                         edge_pen=0.6 if w["cat"] in ("animals", "vehicles") else 0.8)
            res = min(1.0, (crop[2] - crop[0]) / 420)  # source pixels across the 600px output
            if res < 1: notes.append(f"upscaled x{OUT_W / (crop[2] - crop[0]):.1f}")
            final = pre_score(s, sp["strict"], sp["word"] in GRAY_OK) + 0.5 * fit * (0.8 + 0.2 * res)
            if forced: final = max(final, 0.5)
            rcrop = [crop[0] / Lw, crop[1] / Lh, crop[2] / Lw, crop[3] / Lh]
            cand = dict(final=final, s=s, c=c, rcrop=rcrop, fit=fit, notes=notes, how=how)
            if best is None or final > best["final"]: best = cand
        if best is None:
            report["words"][k] = {"status": "no usable thumbnails"}; continue
        c = best["c"]
        if DRY:
            pre[k] = dict(title=c["title"], origin=c["origin"], p=best["s"]["p"], photo=best["s"]["photo"], unsafe=best["s"]["unsafe"],
                          fit=round(best["fit"], 3), final=round(best["final"], 3), notes=best["notes"])
            continue
        im = None
        if c.get("local"):
            try:
                im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, c["local"]))).convert("RGB")
                if im.size[0] * (best["rcrop"][2] - best["rcrop"][0]) < 380: im = None   # too small: get the large version
            except Exception:
                im = None
        if im is None:
            lp = os.path.join(CACHE, "large", h(c["title"]) + ".jpg")
            if not fetch_thumb(c["title"], LARGE_W, lp):
                report["words"][k] = {"status": "download failed"}; continue
            im = ImageOps.exif_transpose(Image.open(lp)).convert("RGB")
        Wi, Hi = im.size
        x0, y0, x1, y1 = best["rcrop"][0] * Wi, best["rcrop"][1] * Hi, best["rcrop"][2] * Wi, best["rcrop"][3] * Hi
        cw = min(x1 - x0, Wi, Hi * 0.75)
        if ov.get("zoom") or ov.get("dx") or ov.get("dy"):  # crop tweak
            cw = cw / float(ov.get("zoom", 1)); cw = min(cw, Wi, Hi * 0.75)
        ch = cw * 4 / 3
        cx = (x0 + x1) / 2 + ov.get("dx", 0) * (x1 - x0); cy = (y0 + y1) / 2 + ov.get("dy", 0) * (y1 - y0)
        x0 = min(max(cx - cw / 2, 0), Wi - cw); y0 = min(max(cy - ch / 2, 0), Hi - ch); x1, y1 = x0 + cw, y0 + ch
        img = im.crop((round(x0), round(y0), round(x1), round(y1))).resize((OUT_W, OUT_H), Image.LANCZOS)
        fn = W.out_name(w["cat"], w["word"])
        save_jpeg(img, os.path.join(OUT_DIR, fn))
        s = best["s"]
        old_t = report["words"].get(k, {}).get("title")
        if old_t and used.get(old_t) == k: used.pop(old_t)
        used[c["title"]] = k
        out[k] = {"file": "w/" + fn, "src": c["src"], "author": c["author"], "license": c["license"],
                  "score": round(best["final"], 3)}
        flags = []
        if s["p"] < 0.5: flags.append(f"low word prob {s['p']:.2f}")
        if best["fit"] < 0.75: flags.append(f"fit {best['fit']:.2f}")
        if s["photo"] < 0.5: flags.append(f"not photo-like {s['photo']:.2f}")
        if s["unsafe"] > 0.5: flags.append(f"check safety {s['unsafe']:.2f}")
        report["words"][k] = {"title": c["title"], "final": round(best["final"], 3), "p": s["p"], "photo": s["photo"],
                              "fit": round(best["fit"], 3), "how": best["how"], "notes": best["notes"], "flags": flags,
                              "origin": c["origin"], "n_cands": len(sc), "forced": bool(forced)}
        if n % 20 == 0:
            print(f"  {n}/{len(words)} {k}: {c['title'][:50]} final={best['final']:.2f} p={s['p']:.2f} fit={best['fit']:.2f}", flush=True)
            dump_json(boxes, BOXES)
            if not DRY:  # checkpoint so a restart loses little
                dump_json(out, JSON_OUT, indent=1)
                dump_json(report, REPORT, indent=1)
    dump_json(boxes, BOXES)
    if DRY:
        old = load_json(os.path.join(CACHE, "precheck.json"), {}); old.update(pre)
        json.dump(old, open(os.path.join(CACHE, "precheck.json"), "w"), ensure_ascii=False, indent=0)
        keep = sorted(k for k, v in old.items() if v["origin"] == "current" and v["p"] >= 0.6 and v["photo"] >= 0.6
                      and v["fit"] >= 0.85 and v["unsafe"] < 0.3)
        json.dump(keep, open(os.path.join(CACHE, "keep_current.json"), "w"))
        print("precheck: current photo good enough for", len(keep), "of", len(old), "words"); return
    allkeys = {w["key"] for w in W.load_words()}
    out = {k: out[k] for k in sorted(out, key=lambda x: x) if k in allkeys}
    dump_json(out, JSON_OUT, indent=1)
    low = {k: v for k, v in report["words"].items() if k in allkeys and (v.get("flags") or v.get("status"))}
    report["low_confidence"] = sorted(low)
    report["summary"] = {"words": len(allkeys), "with_photo": len(out), "flagged": len(low)}
    dump_json(report, REPORT, indent=1)
    print("done:", report["summary"], flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--only"); ap.add_argument("--cats"); ap.add_argument("--top", type=int, default=6)
    ap.add_argument("--meta-only", action="store_true", help="only look up licence/author for the top candidates")
    ap.add_argument("--dry", action="store_true", help="score only (pre-check of current photos), no output")
    a = ap.parse_args()
    DRY = a.dry
    META_ONLY = a.meta_only
    ws = W.load_words()
    if a.only: ws = [w for w in ws if w["key"] in set(a.only.split(","))]
    if a.cats: ws = [w for w in ws if w["cat"] in set(a.cats.split(","))]
    main(ws, a.top)
