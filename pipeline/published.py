"""Print the GEOID of every county that already has files in a data release (one per line)."""
import os
import re
import sys

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
        p = 1
        while True:
            a = requests.get(f"{API}/repos/{repo}/releases/{rel['id']}/assets?per_page=100&page={p}", headers=h, timeout=60).json()
            for x in a:
                m = re.match(r"^(\d{5})-pack\.fpk$", x["name"])
                if m:
                    print(m.group(1))
            if len(a) < 100:
                break
            p += 1
    if len(rows) < 100:
        break
    page += 1
