"""Rewrite the labels of the existing dataset with two classes so the detector learns the difference:
   0 utility_pole   power/telephone poles (what fiber can hang on)
   1 other_pole     street lights, traffic lights, sign and generic poles (ignored by the plan)
"""
import base64
import glob
import os
from concurrent.futures import ThreadPoolExecutor

import mapbox_vector_tile
import requests

T = os.environ["MAPILLARY_TOKEN"]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CLS = {"object--support--utility-pole": 0, "object--support--pole": 1, "object--street-light": 1}


def labels(img_id):
    for _ in range(3):
        try:
            r = requests.get(f"https://graph.mapillary.com/{img_id}/detections", params={"access_token": T, "fields": "value,geometry"}, timeout=30)
            if r.status_code != 200:
                continue
            out = []
            for d in r.json().get("data", []):
                v = d["value"]
                c = CLS.get(v, 1 if v.startswith("object--traffic-light") else None)
                if c is None:
                    continue
                t = mapbox_vector_tile.decode(base64.b64decode(d["geometry"]))
                layer = next(iter(t.values()))
                ext = layer.get("extent", 4096)
                for f in layer["features"]:
                    ring = f["geometry"]["coordinates"][0]
                    xs = [p[0] / ext for p in ring]
                    ys = [p[1] / ext for p in ring]
                    w, h = max(xs) - min(xs), max(ys) - min(ys)
                    if w * h > 1.5e-4 and h > 0.03:
                        out.append((c, min(xs) + w / 2, min(ys) + h / 2, w, h))
            return out
        except Exception:
            pass
    return None


def run(p):
    i = os.path.basename(p)[:-4]
    out = labels(i)
    if out is None:
        return 0, 0
    lp = p.replace("/images/", "/labels/")[:-4] + ".txt"
    with open(lp, "w") as f:
        for c, x, y, w, h in out:
            f.write(f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}\n")
    return sum(1 for o in out if o[0] == 0), sum(1 for o in out if o[0] == 1)


paths = glob.glob(os.path.join(ROOT, "images", "*", "*.jpg"))
with ThreadPoolExecutor(12) as ex:
    res = list(ex.map(run, paths))
print("images", len(paths), "utility poles", sum(r[0] for r in res), "other poles", sum(r[1] for r in res))
open(os.path.join(ROOT, "pole2.yaml"), "w").write(f"path: {ROOT}\ntrain: images/train\nval: images/val\nnames:\n  0: utility_pole\n  1: other_pole\n")
