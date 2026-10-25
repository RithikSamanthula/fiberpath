import glob
import json
import os
import sys

import numpy as np
from ultralytics import YOLO

HERE = os.path.dirname(os.path.abspath(__file__))


def gt(p):
    lp = p.replace("/images/", "/labels/")[:-4] + ".txt"
    out = []
    for l in open(lp):
        c, x, y, w, h = l.split()
        out.append((int(c), float(x), float(y), float(w), float(h)))
    return out


def iou(a, b):
    ax1, ay1, ax2, ay2 = a[0] - a[2] / 2, a[1] - a[3] / 2, a[0] + a[2] / 2, a[1] + a[3] / 2
    bx1, by1, bx2, by2 = b[0] - b[2] / 2, b[1] - b[3] / 2, b[0] + b[2] / 2, b[1] + b[3] / 2
    i = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))
    return i / (a[2] * a[3] + b[2] * b[3] - i + 1e-9)


def match(preds, gts, thr):
    used, tp = set(), 0
    for p in sorted(preds, key=lambda x: -x[4]):
        best, bi = -1, 0
        for k, g in enumerate(gts):
            if k in used:
                continue
            v = iou(p[:4], g[:4])
            if v > bi:
                best, bi = k, v
        if best >= 0 and bi >= thr:
            used.add(best)
            tp += 1
    return tp, used


def evaluate(W, SZ, device="cpu", conf=0.25):
    model = YOLO(W)
    imgs = sorted(glob.glob(os.path.join(HERE, "data", "images", "val", "*.jpg")))
    rows = []
    for k in range(0, len(imgs), 16):
        chunk = imgs[k:k + 16]
        for p, r in zip(chunk, model.predict(chunk, imgsz=SZ, conf=0.2, iou=0.5, device=device, verbose=False, batch=4)):
            G = [g[1:] for g in gt(p) if g[0] == 0]
            P = [(*b, float(s)) for b, c, s in zip(r.boxes.xywhn.numpy(), r.boxes.cls.numpy(), r.boxes.conf.numpy()) if int(c) == 0 and s >= conf]
            rows.append((G, P))
    ngt = sum(len(g) for g, _ in rows)
    npred = sum(len(P) for _, P in rows)
    out = {"photos": len(rows), "labels": ngt}
    for thr in (0.5, 0.3):
        tp = sum(match(P, G, thr)[0] for G, P in rows)
        out[f"iou{thr}"] = {"precision": round(tp / max(npred, 1), 3), "recall": round(tp / max(ngt, 1), 3)}
    by = {}
    for lo, hi, name in ((0, .05, "very far"), (.05, .1, "far"), (.1, .2, "medium"), (.2, 1.01, "near")):
        n = hit = 0
        for G, P in rows:
            _, used = match(P, G, 0.3)
            for k, g in enumerate(G):
                if lo <= g[3] < hi:
                    n += 1
                    hit += k in used
        by[name] = {"labels": n, "recall": round(hit / max(n, 1), 3)}
    out["recallByDistance"] = by
    tp = fp = fn = tn = 0
    for G, P in rows:
        a, b = bool(G), bool(P)
        tp += a and b; fp += (not a) and b; fn += a and not b; tn += (not a) and not b
    out["photo"] = {"accuracy": round((tp + tn) / len(rows), 3), "precision": round(tp / max(tp + fp, 1), 3), "recall": round(tp / max(tp + fn, 1), 3)}
    return out


if __name__ == "__main__":
    W = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "runs", "pole3", "weights", "best.pt")
    SZ = int(sys.argv[2]) if len(sys.argv) > 2 else 800
    print(json.dumps(evaluate(W, SZ, sys.argv[3] if len(sys.argv) > 3 else "cpu"), indent=1))
