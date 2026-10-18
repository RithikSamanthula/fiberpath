"""Bigger, more varied pole dataset: street photos from many counties, two classes, labels read the right way up.

    MAPILLARY_TOKEN=... python collect2.py <per_county_images> <geoid> [<geoid> ...]
Adds to data/ (the existing Towns County photos stay). Split is by 0.02 degree cell so train and val never share a street.
"""
import hashlib
import json
import os
import random
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import relabel  # noqa: E402  (reuses labels(): both classes, y axis fixed)

TOKEN = os.environ["MAPILLARY_TOKEN"]
G = "https://graph.mapillary.com"
ROOT = relabel.ROOT
PER = int(sys.argv[1])
IDX = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "web", "public", "data", "index.json")))
# the index on disk only has local counties; the live one has them all
try:
    live = requests.get("http://localhost:3111/api/index", timeout=30).json()
except Exception:
    live = []
BB = {i["geoid"]: i["bbox"] for i in IDX + live}


def get(url, **p):
    for _ in range(3):
        try:
            r = requests.get(url, params={"access_token": TOKEN, **p}, timeout=30)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return None


def poles_in(bb, step=0.02):
    w, s, e, n = bb
    boxes, lon = [], w
    while lon < e:
        lat = s
        while lat < n:
            boxes.append((lon, lat, min(lon + step, e), min(lat + step, n)))
            lat += step
        lon += step

    def one(b):
        d = get(f"{G}/map_features", fields="id,geometry", object_values="object--support--utility-pole", bbox=f"{b[0]},{b[1]},{b[2]},{b[3]}")
        return [f["geometry"]["coordinates"] for f in (d or {}).get("data", [])]

    with ThreadPoolExecutor(8) as ex:
        return [p for r in ex.map(one, boxes) for p in r]


def images_near(pt):
    r = 0.00025
    d = get(f"{G}/images", fields="id,thumb_1024_url,computed_geometry,is_pano", limit=5, bbox=f"{pt[0]-r},{pt[1]-r},{pt[0]+r},{pt[1]+r}")
    return [i for i in (d or {}).get("data", []) if i.get("thumb_1024_url") and not i.get("is_pano")]


def fetch(i):
    lon, lat = i["computed_geometry"]["coordinates"]
    cell = f"{int(lon / 0.02)}_{int(lat / 0.02)}"
    split = "val" if int(hashlib.md5(cell.encode()).hexdigest(), 16) % 100 < 15 else "train"
    path = os.path.join(ROOT, "images", split, i["id"] + ".jpg")
    if os.path.exists(path):
        return 0
    lab = relabel.labels(i["id"])
    if lab is None:
        return 0
    try:
        r = requests.get(i["thumb_1024_url"], timeout=30)
        if r.status_code != 200:
            return 0
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(r.content)
    except Exception:
        return 0
    lp = path.replace("/images/", "/labels/")[:-4] + ".txt"
    os.makedirs(os.path.dirname(lp), exist_ok=True)
    with open(lp, "w") as f:
        for c, x, y, w, h in lab:
            f.write(f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}\n")
    return 1


random.seed(21)
total = 0
for geoid in sys.argv[2:]:
    if geoid not in BB:
        print("no bbox for", geoid)
        continue
    pts = poles_in(BB[geoid])
    random.shuffle(pts)
    seen, items = set(), []
    with ThreadPoolExecutor(10) as ex:
        for imgs in ex.map(images_near, pts[: PER * 2]):
            for i in imgs[:2]:
                if i["id"] not in seen:
                    seen.add(i["id"])
                    items.append(i)
            if len(items) >= PER * 1.3:
                break
    with ThreadPoolExecutor(10) as ex:
        got = sum(ex.map(fetch, items[: int(PER * 1.2)]))
    total += got
    print(geoid, "poles mapped", len(pts), "new images", got, flush=True)
print("total new images", total)
