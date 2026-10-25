import csv
import gzip
import io
import json
import math
import os

import numpy as np
import requests
from PIL import Image

from common import UA, cache_path, cached_json, http_json

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS = OVERPASS_MIRRORS[0]


def boundary(c):
    def go():
        url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
        d = http_json(url, params={"where": f"GEOID='{c['geoid']}'", "outFields": "NAME", "f": "geojson", "outSR": 4326})
        return d["features"][0]["geometry"]

    return cached_json(c["slug"], "boundary.json", go)


def bbox_of(geom, pad=0.01):
    rings = geom["coordinates"] if geom["type"] == "Polygon" else [r for p in geom["coordinates"] for r in p]
    pts = np.array([p for ring in rings[:1] if True for p in ring] if geom["type"] == "Polygon" else [p for poly in geom["coordinates"] for p in poly[0]])
    return pts[:, 0].min() - pad, pts[:, 1].min() - pad, pts[:, 0].max() + pad, pts[:, 1].max() + pad


def overpass(c, name, body, bb):
    w, s, e, n = bb
    q = f"[out:json][timeout:170][bbox:{s},{w},{n},{e}];{body}"
    def go():
        import random

        last = None
        mirrors = OVERPASS_MIRRORS[:]
        random.shuffle(mirrors)
        for url in mirrors * 2:
            try:
                return http_json(url, data={"data": q}, timeout=200, tries=2)
            except Exception as e:
                last = e
        raise last

    return cached_json(c["slug"], name, go)


def places(c, bb):
    body = 'node["place"~"^(city|town|village)$"]["name"];out;'
    return overpass(c, "places.json", body, bb)["elements"]


def roads(c, bb):
    body = (
        'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|'
        'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]["access"!~"private|no"];out geom;'
    )
    return overpass(c, "roads.json", body, bb)["elements"]


def osm_power(c, bb):
    body = (
        'node["power"="pole"];out;'
        'way["power"="minor_line"];out geom;'
        'way["power"="line"];out geom;'
        'nwr["power"="substation"];out center;'
        'nwr["man_made"~"tower|mast"]["tower:type"="communication"];out center;'
        'nwr["communication:mobile_phone"="yes"]["man_made"~"tower|mast"];out center;'
    )
    return overpass(c, "power.json", body, bb)["elements"]


def quadkeys_for(bb, z=9):
    w, s, e, n = bb

    def tile(lon, lat):
        k = 2**z
        x = int((lon + 180) / 360 * k)
        y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * k)
        return x, y

    x0, y1 = tile(w, s)
    x1, y0 = tile(e, n)
    out = []
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            q = ""
            for i in range(z, 0, -1):
                m = 1 << (i - 1)
                q += str((1 if x & m else 0) + (2 if y & m else 0))
            out.append(q)
    return out


def footprints(c, bb):

    def go():
        links = requests.get(
            "https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv", headers=UA, timeout=120
        ).text
        rows = list(csv.DictReader(io.StringIO(links)))
        feats = []
        w, s, e, n = bb
        for q in quadkeys_for(bb):
            urls = [r["Url"] for r in rows if r["QuadKey"] == q and r["Location"] == "UnitedStates"]
            for u in urls:
                raw = requests.get(u, headers=UA, timeout=300).content
                for line in gzip.decompress(raw).splitlines():
                    f = json.loads(line)
                    ring = f["geometry"]["coordinates"][0]
                    lon = sum(p[0] for p in ring) / len(ring)
                    lat = sum(p[1] for p in ring) / len(ring)
                    if w <= lon <= e and s <= lat <= n:
                        feats.append(ring)
        return feats

    return cached_json(c["slug"], "footprints.json", go)


def mapillary_poles(c, bb):
    token = os.environ.get("MAPILLARY_TOKEN")
    if not token:
        return None

    def go():
        from concurrent.futures import ThreadPoolExecutor

        w, s, e, n = bb
        step = 0.02
        boxes = []
        lon = w
        while lon < e:
            lat = s
            while lat < n:
                boxes.append((lon, lat, min(lon + step, e), min(lat + step, n)))
                lat += step
            lon += step

        def one(b):
            d = http_json(
                "https://graph.mapillary.com/map_features",
                params={
                    "access_token": token,
                    "fields": "id,geometry,object_value,first_seen_at",
                    "object_values": "object--support--utility-pole",
                    "bbox": f"{b[0]},{b[1]},{b[2]},{b[3]}",
                },
                tries=3,
                timeout=40,
            )
            return d.get("data", [])

        out = {}
        with ThreadPoolExecutor(8) as ex:
            for feats in ex.map(one, boxes):
                for f in feats:
                    out[f["id"]] = f["geometry"]["coordinates"]
        return [{"id": k, "lon": v[0], "lat": v[1]} for k, v in out.items()]

    return cached_json(c["slug"], "mapillary_poles.json", go)


def mapillary_images(c, lon, lat, radius=0.0006):
    token = os.environ.get("MAPILLARY_TOKEN")
    if not token:
        return []
    d = http_json(
        "https://graph.mapillary.com/images",
        params={
            "access_token": token,
            "fields": "id,thumb_1024_url,computed_geometry,compass_angle,captured_at",
            "bbox": f"{lon - radius},{lat - radius},{lon + radius},{lat + radius}",
            "limit": 10,
        },
    )
    return d.get("data", [])


def terrain(c, bb, z=13):
    w, s, e, n = bb
    k = 2**z

    def tx(lon):
        return (lon + 180) / 360 * k

    def ty(lat):
        return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * k

    x0, x1 = int(tx(w)), int(tx(e))
    y0, y1 = int(ty(n)), int(ty(s))
    p = cache_path(c["slug"], f"dem_z{z}.npy")
    if os.path.exists(p):
        arr = np.load(p)
    else:
        arr = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), dtype=np.float32)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                u = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
                r = requests.get(u, headers=UA, timeout=60)
                r.raise_for_status()
                im = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGB")).astype(np.float32)
                el = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
                arr[(y - y0) * 256 : (y - y0 + 1) * 256, (x - x0) * 256 : (x - x0 + 1) * 256] = el
        np.save(p, arr)
    return arr, (x0, y0, z)


def canopy(c, bb, shape_hint=None):
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import from_bounds

    from fetch import quadkeys_for as qk

    w, s, e, n = bb

    def merc(lon, lat):
        return lon * 20037508.342789244 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.342789244 / math.pi

    mx0, my0 = merc(w, s)
    mx1, my1 = merc(e, n)
    res = 30.0
    W = int((mx1 - mx0) / res)
    H = int((my1 - my0) / res)
    p = cache_path(c["slug"], "canopy.npy")
    if os.path.exists(p):
        return np.load(p), (mx0, my0, mx1, my1, res)
    out = np.zeros((H, W), dtype=np.float32)
    for q in qk(bb):
        url = f"https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/{q}.tif"
        try:
            with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
                with rasterio.open(url) as ds:
                    l, b, r, t = ds.bounds
                    cl, cb, cr, ct = max(l, mx0), max(b, my0), min(r, mx1), min(t, my1)
                    if cl >= cr or cb >= ct:
                        continue
                    win = from_bounds(cl, cb, cr, ct, ds.transform)
                    ow = max(1, int(round((cr - cl) / res)))
                    oh = max(1, int(round((ct - cb) / res)))
                    a = ds.read(1, window=win, out_shape=(oh, ow), resampling=Resampling.average, masked=True)
                    a = np.ma.filled(a, 0).astype(np.float32)
                    a[(a < 0) | (a > 80)] = 0
                    cx = int(round((cl - mx0) / res))
                    cy = int(round((my1 - ct) / res))
                    hh = min(oh, H - cy)
                    ww = min(ow, W - cx)
                    out[cy : cy + hh, cx : cx + ww] = np.maximum(out[cy : cy + hh, cx : cx + ww], a[:hh, :ww])
        except Exception as ex:
            print("canopy tile failed", q, ex)
    np.save(p, out)
    return out, (mx0, my0, mx1, my1, res)
