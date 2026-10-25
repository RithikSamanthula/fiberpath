#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
export MAPILLARY_TOKEN=unused
../.venv/bin/python - <<'PY'
from ultralytics import YOLO
YOLO("cv/runs/pole3/weights/last.pt").train(resume=True)
PY
