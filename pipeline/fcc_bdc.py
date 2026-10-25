"""Real FCC coverage for a state, from the National Broadband Map's Broadband Data Collection (free account needed).

  1. Register at https://bdc.fcc.gov and generate a token under Manage API Access
  2. FCC_USERNAME=<your email> FCC_TOKEN=<token> python fcc_bdc.py 13        (13 = Georgia's FIPS code)

Every broadband serviceable location in the state is put into one of the federal tiers, using the best
non-satellite service advertised there (satellite is left out, as the BEAD program does):
    served       100 Mbps down and 20 up or better
    underserved  25/3 up to that
    unserved     less than 25/3, or no service
and the counts are summed in each H3 hexagon (resolution 8). Output: data/state-<fips>-fcc-h3.csv with columns
h3_res8_id, served, underserved, unserved. plan.py labels each home with the majority tier of its hexagon.
"""
import csv
import gzip
import io
import json
import os
import sys
import zipfile

import requests

BASE = "https://bdc.fcc.gov/api/public/map"
HERE = os.path.dirname(os.path.abspath(__file__))
TERRESTRIAL = {"Copper", "Cable", "Fiber to the Premises", "Unlicensed Fixed Wireless", "Licensed Fixed Wireless", "LBR Fixed Wireless"}


def headers():
    u, t = os.environ.get("FCC_USERNAME"), os.environ.get("FCC_TOKEN")
    if not u or not t:
        sys.exit("Set FCC_USERNAME and FCC_TOKEN (see the top of this file).")
    return {"username": u, "hash_value": t}


def get(path):
    r = requests.get(BASE + path, headers=headers(), timeout=180)
    if r.status_code != 200:
        sys.exit(f"FCC API error {r.status_code} on {path}: {r.text[:300]}")
    return r.json()


def fetch_csv(file_id):
    """Download one zipped CSV and yield its rows as dicts."""
    r = requests.get(f"{BASE}/downloads/downloadFile/availability/{file_id}/1", headers=headers(), timeout=900)
    r.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(r.content))
    for name in z.namelist():
        if name.lower().endswith(".csv"):
            with z.open(name) as raw:
                yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))


TECH = {"10": "Copper", "40": "Cable", "50": "Fiber", "70": "Fixed wireless", "71": "Fixed wireless", "72": "Fixed wireless"}


def tier(down, up):
    return 2 if (down >= 100 and up >= 20) else (1 if (down >= 25 and up >= 3) else 0)


def main(fips):
    dates = get("/listAsOfDates")["data"]
    asof = sorted({d["as_of_date"] for d in dates if d.get("data_type") == "availability"})[-1]
    print("release", asof, flush=True)
    files = [f for f in get(f"/downloads/listAvailabilityData/{asof}")["data"] if str(f.get("state_fips")) == fips and f.get("category") == "State" and f.get("file_type") == "csv"]
    universe = next((f for f in files if f.get("subcategory") == "Served-Unserved"), None)
    offers = [f for f in files if f.get("subcategory") == "Location Coverage" and f.get("technology_code_desc") in TERRESTRIAL]
    if not universe or not offers:
        sys.exit("Expected files were not found. Listing: " + ", ".join(sorted({str(f.get('subcategory')) for f in files})))
    best = {}
    prov = {}
    for f in offers:
        print("  reading", f["technology_code_desc"], flush=True)
        for row in fetch_csv(f["file_id"]):
            if row.get("business_residential_code") not in ("R", "X"):
                continue
            t = tier(float(row["max_advertised_download_speed"] or 0), float(row["max_advertised_upload_speed"] or 0))
            lid = row["location_id"]
            if t > best.get(lid, -1):
                best[lid] = t
            hx = row.get("h3_res8_id")
            if hx:
                e = prov.setdefault(hx, {}).setdefault((row["brand_name"], TECH.get(row["technology"], "Other")), [0, 0, 0])
                e[0] = max(e[0], float(row["max_advertised_download_speed"] or 0))
                e[1] = max(e[1], float(row["max_advertised_upload_speed"] or 0))
                e[2] += 1
    print("  reading every location", flush=True)
    hexes = {}
    for row in fetch_csv(universe["file_id"]):
        h = row["h3_res8_id"]
        c = hexes.setdefault(h, [0, 0, 0])
        c[best.get(row["location_id"], 0)] += 1
    out = os.path.join(HERE, "data", f"state-{fips}-fcc-h3.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["h3_res8_id", "unserved", "underserved", "served"])
        for h, (u, m, s) in hexes.items():
            w.writerow([h, u, m, s])
    pdir = os.path.join(HERE, "data", "fcc-providers")
    os.makedirs(pdir, exist_ok=True)
    js = {h: sorted(([b, t, int(v[0]), int(v[1]), v[2]] for (b, t), v in d.items()), key=lambda r: -r[2]) for h, d in prov.items()}
    with gzip.open(os.path.join(pdir, f"{fips}.json.gz"), "wt") as fh:
        json.dump(js, fh, separators=(",", ":"))
    tot = [sum(c[i] for c in hexes.values()) for i in range(3)]
    print(f"wrote {out}: {len(hexes)} hexagons; locations unserved {tot[0]:,}, underserved {tot[1]:,}, served {tot[2]:,}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1].zfill(2))
