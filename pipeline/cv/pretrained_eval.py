import glob, json, os, sys, time
import numpy as np
import torch
from PIL import Image
from scipy import ndimage
from transformers import AutoImageProcessor, Mask2FormerForUniversalSegmentation
from analyze import gt, match

HERE = os.path.dirname(os.path.abspath(__file__))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 80
dev = "mps" if torch.backends.mps.is_available() else "cpu"
name = "facebook/mask2former-swin-large-mapillary-vistas-semantic"
proc = AutoImageProcessor.from_pretrained(name)
model = Mask2FormerForUniversalSegmentation.from_pretrained(name).to(dev).eval()
UTIL = [k for k, v in model.config.id2label.items() if v == "Utility Pole"][0]
print("device", dev, "utility pole class id", UTIL, flush=True)

imgs = sorted(glob.glob(os.path.join(HERE, "data", "images", "val", "*.jpg")))
rng = np.random.RandomState(1); rng.shuffle(imgs); imgs = imgs[:N]
rows, t0, shown = [], time.time(), []
for p in imgs:
    im = Image.open(p).convert("RGB"); W, H = im.size
    inp = proc(images=im, return_tensors="pt").to(dev)
    with torch.no_grad(): out = model(**inp)
    seg = proc.post_process_semantic_segmentation(out, target_sizes=[(H, W)])[0].cpu().numpy()
    mask = seg == int(UTIL)
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    P = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        ys, xs = sl; area = (lab[sl] == i).sum()
        h = (ys.stop - ys.start) / H; w = (xs.stop - xs.start) / W
        if area < 40 or h < 0.04: continue
        P.append(((xs.start + xs.stop) / 2 / W, (ys.start + ys.stop) / 2 / H, w, h, float(min(1, area / 400))))
    G = [g[1:] for g in gt(p) if g[0] == 0]
    rows.append((G, P))
print(f"{len(rows)} photos in {time.time()-t0:.0f}s ({(time.time()-t0)/len(rows):.1f}s each)")
ngt = sum(len(g) for g, _ in rows); npred = sum(len(p) for _, p in rows)
res = {"photos": len(rows), "labels": ngt, "preds": npred}
for thr in (0.5, 0.3):
    tp = sum(match(P, G, thr)[0] for G, P in rows)
    res[f"iou{thr}"] = {"precision": round(tp / max(npred, 1), 3), "recall": round(tp / max(ngt, 1), 3)}
tp = fp = fn = tn = 0
for G, P in rows:
    a, b = bool(G), bool(P); tp += a and b; fp += (not a) and b; fn += a and not b; tn += (not a) and not b
res["photo"] = {"accuracy": round((tp + tn) / len(rows), 3), "precision": round(tp / max(tp + fp, 1), 3), "recall": round(tp / max(tp + fn, 1), 3)}
print(json.dumps(res, indent=1))
