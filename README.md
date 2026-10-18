# FiberPath

Every home connected. Every dollar counted.

FiberPath plans the lowest-cost way to bring broadband to every unserved home in a county, and lets any household look up where it stands.

```
pipeline/   Python: downloads public data and builds a county plan
web/        Next.js app that serves the plan (map, household lookup, grant report)
```

## Run the app

```
cd web
npm install
npm run dev          # http://localhost:3000
```

The Towns County, GA plan is already in `web/public/data/towns-ga`.

## Plan any U.S. county

```
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
export MAPILLARY_TOKEN=...
cd pipeline && ../.venv/bin/python plan.py 13111        # any 5-digit county GEOID (state + county FIPS)
sh batch.sh 13111 54075 30059                           # several counties in a row
```

The county's name, boundary, hub town and town cores come from the Census and OpenStreetMap, so no config is needed. Output lands in `web/public/data/<county>/` and `web/public/data/index.json`; the web app picks new counties up automatically (County plans, Compare, Explore, Grant report). Downloads are cached in `pipeline/cache`. A county takes a few minutes to tens of minutes depending on size.

Any address in the country works in the app even without a plan: it gets a live estimate (nearest town, poles on the road, homes nearby, an adjustable cost calculator), a "raise your hand" count, and a "request a plan" button that ranks which counties to plan next.

### Data that needs a key

| Data | How | Effect |
| --- | --- | --- |
| Poles | `export MAPILLARY_TOKEN=...` before running `plan.py` | Roads with Mapillary pole detections price as aerial fiber. Without it only OpenStreetMap poles are used, so most roads price as buried. |
| FCC coverage | Download the BDC availability summary by H3 res 8 hexagon, save as `pipeline/data/towns-ga-fcc-h3.csv` with columns `h3_res8_id` and `max_advertised_download_speed` | Real served/underserved/unserved status. Without it, homes outside the town cores are modeled as unserved and the app says so. |

For the web app, copy `web/.env.example` to `web/.env.local`. Demand pledges need a table in Supabase (or fall back to a local file):

```sql
create table pledges (county text, home text, cell text, created_at timestamptz default now(), primary key (county, home));
```

## What is measured and what is not

- Cost per home is compared with the Blue Ridge Mountain EMC project ($13.1M for 3,700 homes, about $3,540 each).
- Pole precision/recall, FCC home-count agreement and the 20-home line-of-sight spot check have not been run. The report says "Not yet measured" for them.

## Planning every county

`pipeline/national.py` is a resumable queue over all 3,235 U.S. counties and county equivalents:

```
python national.py list              # county list from Census
python national.py run --workers 3   # plan them, rural counties first; stop and restart any time
python national.py status
```

Put GEOIDs in `pipeline/cache/priority.txt` (for example the counties with the most "Request a plan" clicks) and they go first. A single county takes 3 to 15 minutes, so a laptop does a few hundred a day. To finish the country quickly, run the container in `pipeline/Dockerfile` as many parallel jobs (each takes `--state` or a GEOID range) against a shared bucket, and set `NEXT_PUBLIC_DATA_BASE` in the web app to that bucket's public URL.

## The pole detector

`pipeline/cv/collect.py` builds a training set from Mapillary photos, `pipeline/cv/train.py` fine-tunes YOLOv8n on it and writes `web/models/pole.onnx` plus `web/public/data/cv-metrics.json`. The `/api/detect` route runs the model with ONNX Runtime; the Poles screen and every household page can run it on live street photos. The labels are Mapillary's own detections, so the reported precision and recall measure agreement with Mapillary on streets held out of training, not accuracy against hand labels.

## Real FCC coverage

Without FCC data the app marks town centers and dense neighborhoods as served and everything else as unserved, and says so on screen. For the real thing, get a free account at https://bdc.fcc.gov, generate an API token under Manage API Access, then:

```
export FCC_USERNAME=you@example.com FCC_TOKEN=...
cd pipeline && ../.venv/bin/python fcc_bdc.py 13        # one state at a time (13 is Georgia)
../.venv/bin/python plan.py 13281                        # re-plan a county; it now uses the FCC file
```

`fcc_bdc.py` keeps the fastest advertised residential speed in each H3 hexagon, leaves out satellite service as the BEAD program does, and `plan.py` labels a home served at 100/20 Mbps or better, underserved at 25/3 up to that, and unserved below. The older Form 477 data that needs no login is not used: it counts a whole census block as served if one address in it can be, which would hide most unserved homes.
