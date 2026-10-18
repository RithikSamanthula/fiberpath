"""Build a pole-detection dataset from Mapillary: street photos plus the pole boxes Mapillary's own
model drew on them. Split by location (0.02 degree cells) so train and validation never share a street.

    MAPILLARY_TOKEN=... python collect.py towns-ga 1800
"""
import base64
import hashlib
import json
import os
import random
import sys
from concurrent.futures import ThreadPoolExecutor

import mapbox_vector_tile
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import CACHE  # noqa: E402

TOKEN = os.environ["MAPILLARY_TOKEN"]
G = "https://graph.mapillary.com"
slug = sys.argv[1]
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 1800
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(ROOT, exist_ok=True)


def get(url, **p):
    for _ in range(3):
        try:
            r = requests.get(url, params={"access_token": TOKEN, **p}, timeout=30)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return None


def boxes_for(img_id):
    d = get(f"{G}/{img_id}/detections", fields="value,geometry")
    out = []
    for det in (d or {}).get("data", []):
        if det["value"] != "object--support--utility-pole":
            continue
        try:
            t = mapbox_vector_tile.decode(base64.b64decode(det["geometry"]), y_coord_down=True)
            layer = next(iter(t.values()))
            ext = layer.get("extent", 4096)
            for f in layer["features"]:
                ring = f["geometry"]["coordinates"][0]
                xs = [p[0] / ext for p in ring]
                ys = [p[1] / ext for p in ring]
                w, h = max(xs) - min(xs), max(ys) - min(ys)
                if w * h > 2e-4 and h > 0.04:
                    out.append((min(xs), min(ys), w, h))
        except Exception:
            pass
    return out


def images_near(pole):
    r = 0.00025
    d = get(f"{G}/images", fields="id,thumb_1024_url,computed_geometry,is_pano", limit=6,
            bbox=f"{pole['lon']-r},{pole['lat']-r},{pole['lon']+r},{pole['lat']+r}")
    return [i for i in (d or {}).get("data", []) if i.get("thumb_1024_url") and not i.get("is_pano")]


poles = json.load(open(os.path.join(CACHE, slug, "mapillary_poles.json")))
random.seed(7)
random.shuffle(poles)
seen, items = set(), []
with ThreadPoolExecutor(10) as ex:
    for imgs in ex.map(images_near, poles[: TARGET * 2]):
        for i in imgs[:3]:
            if i["id"] not in seen:
                seen.add(i["id"])
                items.append(i)
        if len(items) >= TARGET * 1.5:
            break
print("candidate images", len(items), flush=True)


def build(i):
    b = boxes_for(i["id"])
    return i, b


def fetch(args):
    i, b = args
    lon, lat = i["computed_geometry"]["coordinates"]
    cell = f"{int(lon / 0.02)}_{int(lat / 0.02)}"
    split = "val" if int(hashlib.md5(cell.encode()).hexdigest(), 16) % 100 < 15 else "train"
    path = os.path.join(ROOT, "images", split, i["id"] + ".jpg")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        r = requests.get(i["thumb_1024_url"], timeout=30)
        if r.status_code != 200:
            return None
        open(path, "wb").write(r.content)
    except Exception:
        return None
    lp = path.replace("/images/", "/labels/").replace(".jpg", ".txt")
    os.makedirs(os.path.dirname(lp), exist_ok=True)
    with open(lp, "w") as f:
        for x, y, w, h in b:
            f.write(f"0 {x + w / 2:.6f} {y + h / 2:.6f} {w:.6f} {h:.6f}\n")
    return split, len(b)


with ThreadPoolExecutor(10) as ex:
    built = list(ex.map(build, items))
pos = [x for x in built if x[1]]
neg = [x for x in built if not x[1]]
keep = pos[:TARGET] + neg[: max(60, TARGET // 5)]
print("with poles", len(pos), "without", len(neg), "kept", len(keep), flush=True)
with ThreadPoolExecutor(10) as ex:
    res = [r for r in ex.map(fetch, keep) if r]
n = {"train": 0, "val": 0}
b = {"train": 0, "val": 0}
for s, k in res:
    n[s] += 1
    b[s] += k
print("images", n, "boxes", b)
open(os.path.join(ROOT, "pole.yaml"), "w").write(f"path: {ROOT}\ntrain: images/train\nval: images/val\nnames:\n  0: utility_pole\n")
