"""Real FCC coverage for a state, from the National Broadband Map's public data (Broadband Data Collection).

The data is free but the download needs a free FCC BDC account:
  1. Register at https://bdc.fcc.gov  (Manage API Access -> generate a token)
  2. FCC_USERNAME=<your email> FCC_TOKEN=<the token> python fcc_bdc.py 13
     (13 is the state FIPS code; add county GEOIDs after it to keep only those counties)

It writes data/state-<fips>-fcc-h3.csv with the fastest advertised download and upload speed in every H3
hexagon (resolution 8). plan.py picks that file up automatically and labels the result "FCC".
Satellite service is left out, as the BEAD program does. Business-only service is left out.
"""
import csv
import io
import os
import sys
import zipfile

import requests

BASE = "https://bdc.fcc.gov/api/public/map"
HERE = os.path.dirname(os.path.abspath(__file__))


def headers():
    u, t = os.environ.get("FCC_USERNAME"), os.environ.get("FCC_TOKEN")
    if not u or not t:
        sys.exit("Set FCC_USERNAME and FCC_TOKEN (see the top of this file).")
    return {"username": u, "hash_value": t}


def get(path, **params):
    r = requests.get(BASE + path, headers=headers(), params=params, timeout=120)
    if r.status_code != 200:
        sys.exit(f"FCC API error {r.status_code} on {path}: {r.text[:300]}")
    return r.json()


def main(fips, counties):
    dates = get("/listAsOfDates").get("data", [])
    avail = sorted({d["as_of_date"] for d in dates if str(d.get("data_type", "")).lower().startswith("avail")})
    if not avail:
        sys.exit(f"No availability release found: {dates[:3]}")
    asof = avail[-1]
    print("release", asof, flush=True)
    files = get(f"/downloads/listAvailabilityData/{asof}").get("data", [])
    pick = [
        f for f in files
        if str(f.get("category", "")).lower() == "state"
        and "fixed" in str(f.get("technology_type", "")).lower()
        and str(f.get("state_fips", "")).zfill(2) == fips
        and str(f.get("file_type", "")).lower() == "csv"
    ]
    if not pick:
        print("No matching file. A few of the files on offer:")
        for f in files[:8]:
            print(" ", f)
        sys.exit(1)
    f = pick[0]
    print("downloading", f.get("file_name"), flush=True)
    r = requests.get(f"{BASE}/downloads/downloadFile/availability/{f['file_id']}/1", headers=headers(), stream=True, timeout=600)
    r.raise_for_status()
    tmp = os.path.join(HERE, "cache", f"bdc-{fips}.zip")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    with open(tmp, "wb") as out:
        for chunk in r.iter_content(1 << 20):
            out.write(chunk)
    best = {}
    with zipfile.ZipFile(tmp) as z:
        for name in z.namelist():
            if not name.lower().endswith(".csv"):
                continue
            with z.open(name) as raw:
                rd = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
                for row in rd:
                    if counties and not str(row.get("block_geoid", "")).startswith(tuple(counties)):
                        continue
                    if str(row.get("business_residential_code", "R")) not in ("R", "X"):
                        continue
                    if str(row.get("technology")) in ("60", "61"):  # satellite
                        continue
                    h = row.get("h3_res8_id")
                    if not h:
                        continue
                    d, u = float(row.get("max_advertised_download_speed") or 0), float(row.get("max_advertised_upload_speed") or 0)
                    cur = best.get(h)
                    if cur is None or d > cur[0]:
                        best[h] = (d, max(u, cur[1]) if cur else u)
    os.remove(tmp)
    out = os.path.join(HERE, "data", f"state-{fips}-fcc-h3.csv")
    with open(out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["h3_res8_id", "max_advertised_download_speed", "max_advertised_upload_speed"])
        for h, (d, u) in best.items():
            w.writerow([h, d, u])
    print("wrote", out, len(best), "hexagons")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1].zfill(2), sys.argv[2:])
