"""Publish a finished county to GitHub Releases so the web app can load it the moment it exists.

One release per state ("data-13" for Georgia) holds, for every county in that state:
    <geoid>-pack.fpk   county.json, homes.json, roads.json, plan.json, towers.json, poles.json
    <geoid>-grid.fpk   elev.bin, canopy.bin (terrain and tree height)
and one small index-<state>.json listing every county in the state. The web app polls those indexes.

An .fpk file is gzip( 4-byte little-endian header length | JSON header [{n, len}] | file bytes ).
Needs GITHUB_TOKEN and GITHUB_REPOSITORY (both present inside GitHub Actions). Elsewhere it does nothing.
"""
import gzip
import json
import os
import struct
import threading
import time

import requests

from common import OUT

API = "https://api.github.com"
_lock = threading.Lock()
_assets = {}  # release id -> {name: asset id}
_rel = {}  # tag -> release id

PACK = ["county.json", "homes.json", "roads.json", "plan.json", "towers.json", "poles.json"]
GRID = ["elev.bin", "canopy.bin"]


def _h():
    return {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def enabled():
    return bool(os.environ.get("GITHUB_TOKEN") and os.environ.get("GITHUB_REPOSITORY"))


def build(dirpath, names):
    parts, head = [], []
    for n in names:
        b = open(os.path.join(dirpath, n), "rb").read()
        parts.append(b)
        head.append({"n": n, "len": len(b)})
    hb = json.dumps(head, separators=(",", ":")).encode()
    return gzip.compress(struct.pack("<I", len(hb)) + hb + b"".join(parts), 9)


def _retry(fn, tries=5):
    for i in range(tries):
        try:
            r = fn()
            if r.status_code in (403, 429) and "rate" in r.text.lower():
                time.sleep(60 * (i + 1))
                continue
            if r.status_code < 500:
                return r
        except requests.RequestException:
            pass
        time.sleep(5 * (i + 1))
    raise RuntimeError("GitHub request kept failing")


def release_id(tag):
    repo = os.environ["GITHUB_REPOSITORY"]
    if tag in _rel:
        return _rel[tag]
    r = _retry(lambda: requests.get(f"{API}/repos/{repo}/releases/tags/{tag}", headers=_h(), timeout=60))
    if r.status_code == 404:
        r = _retry(lambda: requests.post(f"{API}/repos/{repo}/releases", headers=_h(), timeout=60,
                                         json={"tag_name": tag, "name": f"County data {tag[5:]}", "body": "Planned counties, published as they finish.", "make_latest": "false"}))
        if r.status_code == 422:  # another job created it first
            r = _retry(lambda: requests.get(f"{API}/repos/{repo}/releases/tags/{tag}", headers=_h(), timeout=60))
    r.raise_for_status()
    _rel[tag] = r.json()["id"]
    return _rel[tag]


def assets(rid):
    repo = os.environ["GITHUB_REPOSITORY"]
    if rid not in _assets:
        out, page = {}, 1
        while True:
            r = _retry(lambda: requests.get(f"{API}/repos/{repo}/releases/{rid}/assets?per_page=100&page={page}", headers=_h(), timeout=60))
            r.raise_for_status()
            rows = r.json()
            out.update({a["name"]: a["id"] for a in rows})
            if len(rows) < 100:
                break
            page += 1
        _assets[rid] = out
    return _assets[rid]


def upload(rid, name, data, ctype="application/octet-stream"):
    repo = os.environ["GITHUB_REPOSITORY"]
    a = assets(rid)
    if name in a:
        _retry(lambda: requests.delete(f"{API}/repos/{repo}/releases/assets/{a.pop(name)}", headers=_h(), timeout=60))
    r = _retry(lambda: requests.post(f"https://uploads.github.com/repos/{repo}/releases/{rid}/assets", params={"name": name}, data=data,
                                     headers={**_h(), "Content-Type": ctype}, timeout=300))
    r.raise_for_status()
    a[name] = r.json()["id"]


def publish(geoid, slug):
    if not enabled():
        return False
    repo = os.environ["GITHUB_REPOSITORY"]
    d = os.path.join(OUT, slug)
    st = geoid[:2]
    tag = f"data-{st}"
    meta = json.load(open(os.path.join(d, "county.json")))
    t = meta["totals"]
    item = {"slug": meta["slug"], "name": meta["name"], "state": meta["state"], "geoid": geoid, "bbox": meta["bbox"],
            "homes": t["homesAll"], "unserved": t["unserved"], "reached": t["fiberHomes"] + t["wirelessHomes"],
            "fiberHomes": t["fiberHomes"], "wirelessHomes": t["wirelessHomes"], "towers": t["towers"],
            "aerialFt": t["aerialFt"], "buriedFt": t["buriedFt"], "dropFt": t["dropFt"], "assumptions": meta["assumptions"],
            "coverageSource": meta["coverageSource"], "plannedAt": meta.get("generatedAt"), "remote": True}
    pack, grid = build(d, PACK), build(d, GRID)
    with _lock:
        rid = release_id(tag)
        upload(rid, f"{geoid}-pack.fpk", pack)
        upload(rid, f"{geoid}-grid.fpk", grid)
        name = f"index-{st}.json"
        cur = []
        try:
            r = requests.get(f"https://github.com/{repo}/releases/download/{tag}/{name}", timeout=60)
            if r.status_code == 200:
                cur = r.json()
        except Exception:
            pass
        cur = [c for c in cur if c["geoid"] != geoid] + [item]
        upload(rid, name, json.dumps(cur, separators=(",", ":")).encode(), "application/json")
    return True
