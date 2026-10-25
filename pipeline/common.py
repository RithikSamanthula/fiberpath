"""Shared helpers: county config, projection, caching, HTTP."""
import json
import math
import os
import time

import numpy as np
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "cache")
OUT = os.environ.get("FIBERPATH_DATA") or os.path.join(os.path.dirname(ROOT), "web", "public", "data")
UA = {"User-Agent": "FiberPath/0.1 (congressional app challenge; rithik.samanthula@gmail.com)"}

COUNTIES = {
    "towns-ga": {
        "slug": "towns-ga",
        "name": "Towns County",
        "state": "GA",
        "geoid": "13281",
        "state_name": "Georgia",
        "hub": (34.9512, -83.7544),
        "cores": [(34.9512, -83.7544, 1800), (34.9367, -83.8466, 1800)],
        "benchmark": {
            "name": "Blue Ridge Mountain EMC",
            "total": 13_100_000,
            "homes": 3700,
            "per_home": 3540,
            "grant": 3_800_000,
        },
    }
}


def cache_path(slug, name):
    d = os.path.join(CACHE, slug)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, name)


def cached_json(slug, name, fn):
    p = cache_path(slug, name)
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    data = fn()
    with open(p, "w") as f:
        json.dump(data, f)
    return data


def http_json(url, params=None, data=None, tries=6, timeout=180):
    last = None
    for i in range(tries):
        try:
            if data is not None:
                r = requests.post(url, data=data, headers=UA, timeout=timeout)
            else:
                r = requests.get(url, params=params, headers=UA, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            last = f"{r.status_code} {r.text[:200]}"
        except Exception as e:
            last = repr(e)
        time.sleep(8 * (i + 1) if "overpass" in url else 3 * (i + 1))
    raise RuntimeError(f"request failed: {url} {last}")


class Proj:
    """Local equirectangular projection in meters around a center."""

    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = 111_320.0 * math.cos(math.radians(lat0))
        self.ky = 110_574.0

    def fwd(self, lon, lat):
        lon = np.asarray(lon, dtype=float)
        lat = np.asarray(lat, dtype=float)
        return (lon - self.lon0) * self.kx, (lat - self.lat0) * self.ky

    def inv(self, x, y):
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        return x / self.kx + self.lon0, y / self.ky + self.lat0


def point_in_polygon(px, py, ring):
    """Ray casting for arrays of points against one ring [(x, y), ...]."""
    ring = np.asarray(ring)
    x, y = ring[:, 0], ring[:, 1]
    inside = np.zeros(len(px), dtype=bool)
    j = len(ring) - 1
    for i in range(len(ring)):
        cond = (y[i] > py) != (y[j] > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (x[j] - x[i]) * (py - y[i]) / (y[j] - y[i]) + x[i]
        inside ^= cond & (px < xint)
        j = i
    return inside


def polygon_area(xs, ys):
    xs = np.asarray(xs)
    ys = np.asarray(ys)
    return 0.5 * abs(np.dot(xs, np.roll(ys, -1)) - np.dot(ys, np.roll(xs, -1)))


FIPS = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
        "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
        "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
        "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
        "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
        "56": "WY", "72": "PR"}


def county_config(arg):
    """Config for a county slug (towns-ga) or a 5-digit GEOID (13111). Any U.S. county works."""
    import re

    if arg in COUNTIES:
        return COUNTIES[arg]
    for c in COUNTIES.values():
        if c["geoid"] == arg:
            return c
    geoid = arg
    d = http_json(
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query",
        params={"where": f"GEOID='{geoid}'", "outFields": "NAME,BASENAME,STATE,CENTLAT,CENTLON", "f": "json", "returnGeometry": "false"},
    )
    a = d["features"][0]["attributes"]
    st = FIPS[a["STATE"]]
    slug = re.sub(r"[^a-z0-9]+", "-", a["BASENAME"].lower()).strip("-") + "-" + st.lower()
    return {"slug": slug, "name": a["NAME"], "state": st, "geoid": geoid,
            "center": (float(a["CENTLAT"]), float(a["CENTLON"])), "benchmark": None, "hub": None, "cores": None}
