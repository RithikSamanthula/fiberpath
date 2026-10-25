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
imgsz = int(sys.argv[4]) if len(sys.argv) > 4 else 640
init = sys.argv[5] if len(sys.argv) > 5 else "yolov8n.pt"
batch = int(sys.argv[6]) if len(sys.argv) > 6 else 16

model = YOLO(init)
model.train(data=data, epochs=epochs, imgsz=imgsz, batch=batch, device="mps", workers=4, project=os.path.join(HERE, "runs"),
            name=name, exist_ok=True, patience=12, verbose=False, plots=False)
best = YOLO(os.path.join(HERE, "runs", name, "weights", "best.pt"))
m = best.val(data=data, imgsz=imgsz, device="mps", plots=False, conf=0.25, iou=0.5)
onnx = best.export(format="onnx", imgsz=imgsz, opset=12, simplify=True)


ntrain = len(os.listdir(os.path.join(HERE, "data", "images", "train")))
nval = len(os.listdir(os.path.join(HERE, "data", "images", "val")))
from analyze import evaluate

ev = evaluate(os.path.join(HERE, "runs", name, "weights", "best.pt"), imgsz, "mps")
ntrain = len(os.listdir(os.path.join(HERE, "data", "images", "train")))
nval = len(os.listdir(os.path.join(HERE, "data", "images", "val")))
metrics = {
    "model": "YOLOv8 fine-tuned to find utility poles (and to tell them from street lights)",
    "trainImages": ntrain,
    "valImages": nval,
    "imgsz": imgsz,
    "precision": ev["iou0.5"]["precision"],
    "recall": ev["iou0.5"]["recall"],
    "precisionLoose": ev["iou0.3"]["precision"],
    "recallLoose": ev["iou0.3"]["recall"],
    "photo": ev["photo"],
    "recallByDistance": ev["recallByDistance"],
    "labels": "Boxes drawn by Mapillary's detector on street photos. Validation photos come from streets held out of training.",
}
os.makedirs(os.path.join(ROOT, "web", "models"), exist_ok=True)
shutil.copy(onnx, os.path.join(ROOT, "web", "models", "pole.onnx"))
json.dump(metrics, open(os.path.join(ROOT, "web", "public", "data", "cv-metrics.json"), "w"), indent=1)
print(metrics)
