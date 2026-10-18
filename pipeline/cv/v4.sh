#!/bin/sh
# Wait for the extra photos, fine-tune the detector at full 1024 px resolution, then install it.
cd "$(dirname "$0")/.." || exit 1
while pgrep -f "cv/collect2.py" >/dev/null; do sleep 20; done
export MAPILLARY_TOKEN=unused
../.venv/bin/python -u cv/train.py 14 pole2.yaml pole4 1024 cv/runs/pole3/weights/best.pt 12 > cache/train4.log 2>&1
RUN=pole4 IMGSZ=1024 sh cv/finish.sh >> cache/finish.log 2>&1
