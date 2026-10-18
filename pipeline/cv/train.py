"""Train FiberPath's utility-pole detector (YOLOv8n) on the Mapillary dataset from collect.py,
then validate on streets the model never saw and export ONNX for the web app.

    python train.py [epochs]
"""
import json
import os
import shutil
import sys

from ultralytics import YOLO

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
data = os.path.join(HERE, "data", "pole.yaml")
epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 40
if len(sys.argv) > 2:
    data = os.path.join(HERE, "data", sys.argv[2])
name = sys.argv[3] if len(sys.argv) > 3 else "pole"

model = YOLO("yolov8n.pt")
model.train(data=data, epochs=epochs, imgsz=640, batch=16, device="mps", workers=4, project=os.path.join(HERE, "runs"),
            name=name, exist_ok=True, patience=12, verbose=False, plots=False)
best = YOLO(os.path.join(HERE, "runs", name, "weights", "best.pt"))
m = best.val(data=data, imgsz=640, device="mps", plots=False, conf=0.25, iou=0.5)
onnx = best.export(format="onnx", imgsz=640, opset=12, simplify=True)

ntrain = len(os.listdir(os.path.join(HERE, "data", "images", "train")))
nval = len(os.listdir(os.path.join(HERE, "data", "images", "val")))
names = best.names
per = {}
try:
    for i, c in enumerate(m.box.ap_class_index):
        per[names[int(c)]] = {"precision": round(float(m.box.p[i]), 3), "recall": round(float(m.box.r[i]), 3), "map50": round(float(m.box.ap50[i]), 3)}
except Exception:
    pass
metrics = {
    "model": "YOLOv8n fine-tuned to tell utility poles from street lights and other poles",
    "classes": list(names.values()),
    "perClass": per,
    "trainImages": ntrain,
    "valImages": nval,
    "precision": round(float(m.box.mp), 3),
    "recall": round(float(m.box.mr), 3),
    "map50": round(float(m.box.map50), 3),
    "labels": "Boxes drawn by Mapillary's detector on street photos. Validation photos come from streets held out of training.",
}
os.makedirs(os.path.join(ROOT, "web", "models"), exist_ok=True)
shutil.copy(onnx, os.path.join(ROOT, "web", "models", "pole.onnx"))
json.dump(metrics, open(os.path.join(ROOT, "web", "public", "data", "cv-metrics.json"), "w"), indent=1)
print(metrics)
