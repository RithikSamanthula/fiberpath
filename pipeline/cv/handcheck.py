"""Turn the answers from the /label page into the hand-checked accuracy numbers shown on the About page.

    python handcheck.py ~/Downloads/fiberpath-handchecks.json
"""
import json
import os
import sys

src = sys.argv[1]
rows = json.load(open(src))
real = sum(1 for r in rows for b in r["boxes"] if b["ok"])
fake = sum(1 for r in rows for b in r["boxes"] if not b["ok"])
missed = sum(len(r["missed"]) for r in rows)
out = {
    "photos": len(rows),
    "marked": real + fake,
    "real": real,
    "notPole": fake,
    "missed": missed,
    "precision": round(real / max(real + fake, 1), 3),
    "recall": round(real / max(real + missed, 1), 3),
    "note": "Answers from team members who looked at each photo, on counties the detector was not trained on.",
}
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "web", "public", "data", "cv-handcheck.json")
json.dump(out, open(dest, "w"), indent=1)
print(out)
