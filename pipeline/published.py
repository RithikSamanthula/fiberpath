"""Print the GEOID of every county already planned with real FCC coverage (one per line).

Counties planned earlier with the stand-in coverage estimate are not counted, so they get planned again."""
import json
import os

import requests

API = "https://api.github.com"
repo = os.environ["GITHUB_REPOSITORY"]
h = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json"}
page = 1
while True:
    r = requests.get(f"{API}/repos/{repo}/releases?per_page=100&page={page}", headers=h, timeout=60)
    r.raise_for_status()
    rows = r.json()
    for rel in rows:
        if not rel["tag_name"].startswith("data-"):
            continue
        st = rel["tag_name"][5:]
        a = next((x for x in rel.get("assets", []) if x["name"] == f"index-{st}.json"), None)
        if not a:
            continue
        j = requests.get(f"{API}/repos/{repo}/releases/assets/{a['id']}", headers={**h, "Accept": "application/octet-stream"}, timeout=120)
        if j.status_code != 200:
            continue
        for item in json.loads(j.content):
            if item.get("coverageSource") == "fcc":
                print(item["geoid"])
    if len(rows) < 100:
        break
    page += 1
