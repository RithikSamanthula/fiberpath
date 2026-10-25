#!/bin/sh
cd "$(dirname "$0")/../../web" || exit 1
while pgrep -f "cv/train.py" >/dev/null; do sleep 20; done
[ -f models/pole.onnx ] || { echo "no model produced"; exit 1; }
echo "{\"imgsz\": ${IMGSZ:-800}}" > models/pole.json
(cd ../pipeline/cv && ../../.venv/bin/python - <<'PY'
import json, os, glob
from analyze import evaluate
name = os.environ.get('RUN', 'pole3')
ev = evaluate(f'runs/{name}/weights/best.pt', int(os.environ.get('IMGSZ', 800)), 'cpu')
m = {'model': 'YOLOv8 fine-tuned to find utility poles (and to tell them from street lights)', 'trainImages': len(os.listdir('data/images/train')), 'valImages': len(os.listdir('data/images/val')), 'imgsz': int(os.environ.get('IMGSZ', 800)), 'precision': ev['iou0.5']['precision'], 'recall': ev['iou0.5']['recall'], 'precisionLoose': ev['iou0.3']['precision'], 'recallLoose': ev['iou0.3']['recall'], 'photo': ev['photo'], 'recallByDistance': ev['recallByDistance'], 'labels': "Boxes drawn by Mapillary's detector on street photos. Validation photos come from streets held out of training."}
json.dump(m, open('../../web/public/data/cv-metrics.json', 'w'), indent=1)
print(m)
PY
)
curl -s -m 5 localhost:3111/api/index >/dev/null || { (npx next start -p 3111 >/tmp/fp-next.log 2>&1 &); sleep 8; }
node scripts/bake-cv-demo.mjs 6
cd .. && git add -A && git -c user.name=RithikSamanthula -c user.email=rithik.samanthula@gmail.com commit -q -m "Install the retrained pole detector and baked demo photos" && git push -q origin main
echo finished
