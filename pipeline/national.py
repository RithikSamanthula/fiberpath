import argparse
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from common import CACHE, COUNTIES, OUT, http_json

HERE = os.path.dirname(os.path.abspath(__file__))
LIST = os.path.join(CACHE, "counties.json")
STATUS = os.path.join(CACHE, "status.json")
LIMIT_S = 90 * 60


def fetch_list():
    os.makedirs(CACHE, exist_ok=True)
    out, off = [], 0
    while True:
        d = http_json(
            "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query",
            params={"where": "1=1", "outFields": "GEOID,NAME,STATE,AREALAND,CENTLAT,CENTLON", "returnGeometry": "false", "f": "json",
                    "orderByFields": "GEOID", "resultOffset": off, "resultRecordCount": 1000},
        )
        feats = d.get("features", [])
        out += [f["attributes"] for f in feats]
        if len(feats) < 1000:
            break
        off += 1000
    json.dump(out, open(LIST, "w"))
    os.makedirs(OUT, exist_ok=True)
    json.dump([[c["GEOID"], c["NAME"], c["STATE"], float(c["CENTLAT"]), float(c["CENTLON"])] for c in out],
              open(os.path.join(OUT, "counties.json"), "w"), separators=(",", ":"))
    print(len(out), "counties")


def load_status():
    return json.load(open(STATUS)) if os.path.exists(STATUS) else {}


def save_status(s):
    tmp = STATUS + f".{os.getpid()}.tmp"
    json.dump(s, open(tmp, "w"), indent=0)
    os.replace(tmp, STATUS)


def queue(args, st):
    counties = json.load(open(LIST))
    prio = []
    for pf in (os.path.join(HERE, "priority.txt"), os.path.join(CACHE, "priority.txt")):
        if os.path.exists(pf):
            prio += [l.strip() for l in open(pf) if l.strip() and l.strip() not in prio]
    done = {i["geoid"] for i in json.load(open(os.path.join(OUT, "index.json")))} if os.path.exists(os.path.join(OUT, "index.json")) else set()
    todo = []
    for c in counties:
        g = c["GEOID"]
        if args.state and c["STATE"] != args.state:
            continue
        if g in done or g in {x["geoid"] for x in COUNTIES.values()} & done:
            continue
        s = st.get(g, {}).get("status")
        if s == "done" or (s == "failed" and not args.retry_failed):
            continue
        todo.append(c)
    key = lambda c: (0 if c["GEOID"] in prio else 1, prio.index(c["GEOID"]) if c["GEOID"] in prio else 0, 0 if c["AREALAND"] >= 300e6 else 1, c["AREALAND"])
    todo.sort(key=key)
    return todo[: args.limit] if args.limit else todo


def work(c, st, lock_path):
    g = c["GEOID"]
    t0 = time.time()
    log = os.path.join(CACHE, f"run-{g}.log")
    try:
        r = subprocess.run([sys.executable, "-u", "plan.py", g], cwd=HERE, env={**os.environ, "FIBERPATH_CLEAN": "1"}, stdout=open(log, "w"), stderr=subprocess.STDOUT, timeout=LIMIT_S)
        ok = r.returncode == 0
    except subprocess.TimeoutExpired:
        ok = False
    st = load_status()
    st[g] = {"status": "done" if ok else "failed", "name": c["NAME"], "seconds": round(time.time() - t0)}
    save_status(st)
    print(("done  " if ok else "FAIL  ") + g, c["NAME"], st[g]["seconds"], "s", flush=True)
    if ok:
        try:
            import publish
            from common import county_config

            if publish.enabled() and publish.publish(g, county_config(g)["slug"]):
                print("published", g, flush=True)
        except Exception as e:
            print("publish failed", g, e, flush=True)
    return ok


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["list", "run", "status"])
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--state", default="")
    ap.add_argument("--retry-failed", action="store_true")
    ap.add_argument("--shard", default="", help="k/N: take every Nth county of the queue, offset k")
    ap.add_argument("--budget-min", type=float, default=0, help="stop starting new counties after this many minutes")
    ap.add_argument("--done-file", default="", help="text file of GEOIDs already planned elsewhere; skipped")
    ap.add_argument("--completed-out", default="", help="append the GEOID of each county finished in this run")
    a = ap.parse_args()
    if a.cmd == "list":
        fetch_list()
    elif a.cmd == "status":
        st = load_status()
        n = len(json.load(open(LIST))) if os.path.exists(LIST) else 0
        d = sum(1 for v in st.values() if v["status"] == "done")
        f = sum(1 for v in st.values() if v["status"] == "failed")
        print(f"{d} done, {f} failed, {n - d - f} to go of {n}")
    else:
        if not os.path.exists(LIST):
            fetch_list()
        st = load_status()
        if a.done_file and os.path.exists(a.done_file):
            for g in open(a.done_file).read().split():
                st.setdefault(g, {"status": "done", "name": "", "seconds": 0})
        q = queue(a, st)
        if a.shard:
            k, N = (int(x) for x in a.shard.split("/"))
            counts = {}
            for c in json.load(open(LIST)):
                counts[c["STATE"]] = counts.get(c["STATE"], 0) + 1
            load, owner = [0] * N, {}
            for s, cnt in sorted(counts.items(), key=lambda kv: -kv[1]):
                j = load.index(min(load))
                owner[s] = j
                load[j] += cnt
            q = [c for c in q if owner[c["STATE"]] == k]
        print(len(q), "counties queued", flush=True)
        t_start = time.time()

        def guarded(c):
            if a.budget_min and (time.time() - t_start) / 60 > a.budget_min:
                return
            ok = work(c, st, None)
            if ok and a.completed_out:
                with open(a.completed_out, "a") as f:
                    f.write(c["GEOID"] + "\n")

        with ThreadPoolExecutor(a.workers) as ex:
            list(ex.map(guarded, q))
