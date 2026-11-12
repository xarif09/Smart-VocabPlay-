"""Subject framing for the 3:4 word photos (v3.21).

detect(det, im)            -> raw detections (YOLO all classes + U2Net salient components), normalised 0..1, cacheable
subject_box(raw, sp, ov)   -> (box, how, centre)   main subject = union of its parts (YOLO boxes of the target
                              classes, extended by the salient blob that overlaps them; else the salient blob)
plan(W, H, box, how, ...)  -> (crop, info)          3:4 window: subject fills ~72% of the limiting side, margin >= 6%,
                              centred horizontally, slightly above centre vertically; people keep their head;
                              scenes use the whole height centred on the main element.
info["fits"] is False when the subject (plus a small margin) cannot fit in any 3:4 window of the source
-> the caller should try another candidate photo.
"""
import numpy as np

FILL = 0.72        # subject box / frame on the limiting side (target)
FILL_MAX = 0.88    # => margin >= 6% each side
FILL_MIN = 0.55    # looser than this = subject too small (only accepted when the source has no more pixels)
Y_CENTRE = 0.47    # box centre sits slightly above the frame centre
MIN_SRC_W = 280    # never crop narrower than this many source pixels (max 2.1x upscale to 600px)

ANIMAL_COCO = {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "teddy_bear"}


def detect(det, im, max_side=960):
    """Run YOLO + U2Net on a PIL image. Returns a json-serialisable dict with normalised boxes."""
    W, H = im.size
    s = min(1.0, max_side / max(W, H))
    if s < 1:
        im = im.resize((max(1, round(W * s)), max(1, round(H * s))))
    w, h = im.size
    yolo = [[c, round(conf, 3), [b[0] / w, b[1] / h, b[2] / w, b[3] / h]] for c, conf, b in det.yolo_boxes(im)]
    m = det.saliency(im)
    comps, cen = components(m)
    return {"yolo": yolo, "sal": comps, "cen": cen}


def components(m, thr=0.5):
    """salient connected components (boxes, area fraction), largest first, + saliency-weighted centre"""
    from scipy import ndimage
    H, W = m.shape
    cen = None
    if m.sum() > 1:
        ys, xs = np.mgrid[0:H, 0:W]
        cen = [float((xs * m).sum() / m.sum() / W), float((ys * m).sum() / m.sum() / H)]
    b = m > thr
    lab, n = ndimage.label(b)
    out = []
    if n:
        areas = ndimage.sum(b, lab, range(1, n + 1))
        sl = ndimage.find_objects(lab)
        for i, (a, ss) in enumerate(zip(areas, sl)):
            if a < 0.002 * W * H: continue
            out.append([[ss[1].start / W, ss[0].start / H, ss[1].stop / W, ss[0].stop / H], round(float(a) / (W * H), 4)])
    out.sort(key=lambda x: -x[1])
    return out[:12], cen


def area(b): return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def inter(a, b): return [max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])]


def union(bs): return [min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)]


def expand(b, f): w, h = b[2] - b[0], b[3] - b[1]; return [b[0] - f * w, b[1] - f * h, b[2] + f * w, b[3] + f * h]


def sal_box(raw):
    """main salient blob: the largest component + every component that is >= 15% of it or touches its box"""
    cs = raw.get("sal") or []
    if not cs: return None
    main = cs[0]
    keep = [main[0]]
    mb = expand(main[0], 0.05)
    for b, a in cs[1:]:
        if a >= 0.15 * main[1] or area(inter(b, mb)) > 0: keep.append(b)
    return union(keep)


def subject_box(raw, sp, ov, cat="", main_only=False):
    """(box, how, centre) in normalised coords"""
    if ov.get("box"): return list(ov["box"]), "override", None
    mode = ov.get("mode") or sp["mode"]
    if mode == "scene": return [0, 0, 1, 1], "scene", raw.get("cen")
    want = set()
    if sp.get("coco"): want.add(sp["coco"])
    if cat == "animals": want |= ANIMAL_COCO
    if mode == "person": want.add("person")
    ys = [(c, conf, b) for c, conf, b in raw.get("yolo", []) if c in want and conf >= 0.3]
    S = sal_box(raw)
    if ys:
        big = max(area(b) for _, _, b in ys)
        keep = [b for _, _, b in ys if area(b) >= (0.999 if main_only else 0.25) * big]
        Y = union(keep)
        how = "yolo"
        if S and area(inter(S, Y)) > 0.3 * min(area(S), area(Y)):
            # salient parts YOLO trimmed (tails, legs, antennae) — only close to the YOLO box
            Y = union([Y, inter(S, expand(Y, 0.18))]); how = "yolo+sal"
        return Y, how, raw.get("cen")
    if S: return S, "saliency", raw.get("cen")
    return [0, 0, 1, 1], "none", raw.get("cen")


def plan(W, H, box, how, centre=None, mode="object", ov=None, fill=FILL):
    """box in pixels. Returns crop [x0,y0,x1,y1] (pixels) and info dict."""
    ov = ov or {}
    fill = fill * float(ov.get("zoom", 1))
    cwmax = min(W, H * 0.75)
    info = {"how": how}
    x0, y0, x1, y1 = box
    bw, bh = max(1.0, x1 - x0), max(1.0, y1 - y0)
    full = bw >= 0.9 * W and bh >= 0.9 * H
    if how == "saliency" and bw * bh < 0.04 * W * H:
        # tiny salient blob on a close-up (a pore, a highlight): don't trust it — keep the whole photo, nudged to it
        how, centre = "none", ((x0 + x1) / 2 / W, (y0 + y1) / 2 / H)
    if how in ("scene", "none") or full:
        # whole scene (or subject fills the photo): biggest 3:4 window, nudged toward the main element
        cw = cwmax / float(ov.get("zoom", 1)) if ov.get("zoom") else cwmax
        cw = min(cwmax, max(cw, MIN_SRC_W)); ch = cw * 4 / 3
        cx, cy = (centre[0] * W, centre[1] * H) if centre else (W / 2, H / 2)
        cx = W / 2 + 0.6 * (cx - W / 2); cy = H / 2 + 0.6 * (cy - H / 2)
        cx += ov.get("dx", 0) * cw; cy += ov.get("dy", 0) * ch
        X0 = min(max(cx - cw / 2, 0), W - cw); Y0 = min(max(cy - ch / 2, 0), H - ch)
        info.update(fits=True, fill=None, kind="scene" if how == "scene" else "full")
        return [X0, Y0, X0 + cw, Y0 + ch], info
    # subject truncated by the source photo itself
    tol = 0.01
    edges = [s for s, v in (("L", x0 / W), ("T", y0 / H), ("R", 1 - x1 / W), ("B", 1 - y1 / H)) if v <= tol]
    info["src_edges"] = "".join(edges)
    need = max(bw, bh * 0.75)                 # width of the tightest 3:4 window holding the box
    cw = need / fill
    cw = max(cw, min(cwmax, MIN_SRC_W))
    if how == "saliency": cw = max(cw, 0.5 * cwmax)     # saliency-only boxes are less reliable: never zoom > 2x
    cw = min(cw, cwmax)
    ch = cw * 4 / 3
    f = max(bw / cw, bh / ch)
    info["fill"] = round(f, 3)
    info["fits"] = f <= 1.0 + 1e-6
    info["tight"] = f > FILL_MAX
    info["loose"] = f < FILL_MIN
    cx = (x0 + x1) / 2 + ov.get("dx", 0) * cw
    if mode == "person" and (bh > ch * 0.98 or bw > cw):
        # taller than the frame: keep the head, cut the legs
        cy0 = y0 - 0.04 * ch
        Y0 = cy0
    else:
        Y0 = (y0 + y1) / 2 - Y_CENTRE * ch
    Y0 += ov.get("dy", 0) * ch
    X0 = cx - cw / 2
    X0 = min(max(X0, 0), W - cw); Y0 = min(max(Y0, 0), H - ch)
    crop = [X0, Y0, X0 + cw, Y0 + ch]
    m = [(x0 - crop[0]) / cw, (y0 - crop[1]) / ch, (crop[2] - x1) / cw, (crop[3] - y1) / ch]
    info["margins"] = [round(v, 3) for v in m]
    info["cut"] = "".join(s for s, v in zip("LTRB", m) if v < -0.01 and s not in edges)
    info["src_px"] = round(cw)
    return crop, info


def score(info):
    """framing quality 0..1 for choosing between candidates"""
    if info.get("kind"): return 0.85
    s = 1.0
    if not info["fits"]: s -= 0.5 + 0.5 * min(1, info["fill"] - 1)
    elif info["tight"]: s -= 0.15
    if info["loose"]: s -= 0.25 * (FILL_MIN - info["fill"]) / FILL_MIN + 0.1
    s -= 0.2 * len(info.get("src_edges", ""))
    if info.get("cut"): s -= 0.3
    return max(0.0, s)
