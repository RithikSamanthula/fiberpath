import json, os, shutil
from ultralytics import YOLO
from analyze import evaluate

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "..", "web")
v4 = os.path.join(HERE, "runs", "pole4", "weights", "best.pt")
v3 = os.path.join(HERE, "runs", "pole3", "weights", "best.pt")
print("exporting v4 ...", flush=True)
onnx = YOLO(v4).export(format="onnx", imgsz=1024, opset=12, simplify=True, device="cpu")
e4 = evaluate(v4, 1024, "cpu")
print("v4", json.dumps(e4), flush=True)
e3 = evaluate(v3, 800, "cpu")
print("v3", json.dumps(e3), flush=True)
use4 = e4["photo"]["accuracy"] + e4["iou0.5"]["recall"] >= e3["photo"]["accuracy"] + e3["iou0.5"]["recall"]
ev, size, name = (e4, 1024, "pole4") if use4 else (e3, 800, "pole3")
if use4:
    shutil.copy(onnx, os.path.join(WEB, "models", "pole.onnx"))
else:
    print("v3 scored better; keeping it", flush=True)
json.dump({"imgsz": size}, open(os.path.join(WEB, "models", "pole.json"), "w"))
m = {"model": "YOLOv8 fine-tuned to find utility poles (and to tell them from street lights)",
     "trainImages": len(os.listdir(os.path.join(HERE, "data", "images", "train"))), "valImages": ev["photos"], "imgsz": size,
     "precision": ev["iou0.5"]["precision"], "recall": ev["iou0.5"]["recall"],
     "precisionLoose": ev["iou0.3"]["precision"], "recallLoose": ev["iou0.3"]["recall"],
     "photo": ev["photo"], "recallByDistance": ev["recallByDistance"],
     "labels": "Boxes drawn by Mapillary's detector on street photos. Validation photos come from streets held out of training."}
json.dump(m, open(os.path.join(WEB, "public", "data", "cv-metrics.json"), "w"), indent=1)
print("installed", name, flush=True)
