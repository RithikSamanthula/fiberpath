import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys

import numpy as np
import requests
from ultralytics import YOLO

from analyze import evaluate

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WEB = os.path.join(ROOT, "web")
STATE = os.path.join(HERE, "auto_state.json")
CUR = os.path.join(HERE, "runs", "current.pt")
SZ = 1024
HAND = os.path.join(HERE, "hand")
MIN_NEW = int(sys.argv[1]) if len(sys.argv) > 1 else 20


def token():
    t = os.environ.get("MAPILLARY_TOKEN")
    if t:
        return t
    for line in open(os.path.join(WEB, ".env.local")):
        if line.startswith("MAPILLARY_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("MAPILLARY_TOKEN not found")


def answers():
    rows = {}
    f = os.path.join(WEB, ".data", "labels.jsonl")
    if os.path.exists(f):
        for line in open(f):
            try:
                r = json.loads(line)
                rows[r["id"]] = r
            except Exception:
                pass
    for p in glob.glob(os.path.expanduser("~/Downloads/fiberpath-handchecks*.json")):
        for r in json.load(open(p)):
            if r.get("id"):
                rows[r["id"]] = r
    return rows


def fetch(tok, pid, dest):
    if os.path.exists(dest):
        return True
    d = requests.get(f"https://graph.mapillary.com/{pid}", params={"fields": "thumb_2048_url,thumb_1024_url", "access_token": tok}, timeout=30).json()
    url = d.get("thumb_2048_url") or d.get("thumb_1024_url")
    if not url:
        return False
    open(dest, "wb").write(requests.get(url, timeout=60).content)
    return True


def hold_out(pid):
    return int(hashlib.md5(pid.encode()).hexdigest(), 16) % 5 == 0


def lines(r):
    out = []
    for b in [b for b in r["boxes"] if b["ok"]] + r["missed"]:
        out.append(f"0 {b['x'] + b['w'] / 2:.6f} {b['y'] + b['h'] / 2:.6f} {b['w']:.6f} {b['h']:.6f}")
    return out


def iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    i = max(0, x2 - x1) * max(0, y2 - y1)
    return i / (a[2] * a[3] + b[2] * b[3] - i + 1e-9)


def hand_f1(weights, held):
    m = YOLO(weights)
    tp = fp = fn = 0
    for pid, r in held:
        gt = [(b["x"], b["y"], b["w"], b["h"]) for b in r["boxes"] if b["ok"]] + [(b["x"], b["y"], b["w"], b["h"]) for b in r["missed"]]
        res = m.predict(os.path.join(HAND, pid + ".jpg"), imgsz=SZ, conf=0.3, iou=0.5, device="cpu", verbose=False)[0]
        pr = [tuple(b) for b, c in zip(res.boxes.xywhn.numpy(), res.boxes.cls.numpy()) if int(c) == 0]
        pr = [(x - w / 2, y - h / 2, w, h) for x, y, w, h in pr]
        used = set()
        for p in pr:
            j = next((k for k, g in enumerate(gt) if k not in used and iou(p, g) >= 0.5), None)
            if j is None:
                fp += 1
            else:
                used.add(j)
                tp += 1
        fn += len(gt) - len(used)
    return 2 * tp / max(2 * tp + fp + fn, 1)


def main():
    os.makedirs(HAND, exist_ok=True)
    state = json.load(open(STATE)) if os.path.exists(STATE) else {"used": 0}
    if not os.path.exists(CUR):
        shutil.copy(os.path.join(HERE, "runs", "pole4", "weights", "best.pt"), CUR)
    rows = answers()
    if len(rows) - state["used"] < MIN_NEW:
        print(f"{len(rows)} answered photos, {state['used']} already learned; waiting for {MIN_NEW} new")
        return
    tok = token()
    ok = {}
    for pid, r in rows.items():
        try:
            if fetch(tok, pid, os.path.join(HAND, pid + ".jpg")):
                ok[pid] = r
        except Exception as e:
            print("skip", pid, e)
    held = [(p, r) for p, r in ok.items() if hold_out(p)]
    train = [(p, r) for p, r in ok.items() if not hold_out(p)]
    print(f"{len(train)} photos to learn from, {len(held)} kept for testing")

    for d in ("train",):
        for f in glob.glob(os.path.join(HERE, "data", "*", d, "hand_*")):
            os.remove(f)
    for pid, r in train:
        for k in range(3):
            shutil.copy(os.path.join(HAND, pid + ".jpg"), os.path.join(HERE, "data", "images", "train", f"hand_{pid}_{k}.jpg"))
            open(os.path.join(HERE, "data", "labels", "train", f"hand_{pid}_{k}.txt"), "w").write("\n".join(lines(r)) + "\n")
    for f in glob.glob(os.path.join(HERE, "data", "labels", "*.cache")):
        os.remove(f)

    m = YOLO(CUR)
    m.train(data=os.path.join(HERE, "data", "pole2.yaml"), epochs=8, imgsz=SZ, batch=8, device="mps", workers=4, lr0=0.002, warmup_epochs=0,
            project=os.path.join(HERE, "runs"), name="auto", exist_ok=True, patience=5, verbose=False, plots=False)
    new = os.path.join(HERE, "runs", "auto", "weights", "best.pt")

    e_new, e_old = evaluate(new, SZ, "cpu"), evaluate(CUR, SZ, "cpu")
    s = lambda e: e["photo"]["accuracy"] + e["iou0.5"]["recall"]
    h_new, h_old = (hand_f1(new, held), hand_f1(CUR, held)) if len(held) >= 8 else (1, 0)
    print(f"standard: old {s(e_old):.3f} new {s(e_new):.3f}; hand-checked photos: old {h_old:.3f} new {h_new:.3f}")
    state["used"] = len(rows)
    json.dump(state, open(STATE, "w"))
    if s(e_new) < s(e_old) - 0.01 or h_new < h_old:
        print("new model is not better; keeping the current one")
        return
    onnx = YOLO(new).export(format="onnx", imgsz=SZ, opset=12, simplify=True, device="cpu")
    shutil.copy(onnx, os.path.join(WEB, "models", "pole.onnx"))
    shutil.copy(new, CUR)
    json.dump({"imgsz": SZ}, open(os.path.join(WEB, "models", "pole.json"), "w"))
    m = {"model": "YOLOv8 fine-tuned to find utility poles (and to tell them from street lights)",
         "trainImages": len(os.listdir(os.path.join(HERE, "data", "images", "train"))), "valImages": e_new["photos"], "imgsz": SZ,
         "precision": e_new["iou0.5"]["precision"], "recall": e_new["iou0.5"]["recall"],
         "precisionLoose": e_new["iou0.3"]["precision"], "recallLoose": e_new["iou0.3"]["recall"],
         "photo": e_new["photo"], "recallByDistance": e_new["recallByDistance"],
         "labels": "Boxes drawn by Mapillary's detector on street photos, plus photos checked by hand. Validation photos come from streets held out of training."}
    json.dump(m, open(os.path.join(WEB, "public", "data", "cv-metrics.json"), "w"), indent=1)
    YOLO(new).export(format="onnx", imgsz=640, opset=12, simplify=True, device="cpu")
    shutil.copy(os.path.join(HERE, "runs", "auto", "weights", "best.onnx"), os.path.join(WEB, "public", "models", "pole-640.onnx"))
    shutil.copy(onnx, os.path.join(WEB, "models", "pole.onnx"))
    print("installed")
    subprocess.run(["git", "add", "-A"], cwd=ROOT)
    subprocess.run(["git", "-c", "user.name=RithikSamanthula", "-c", "user.email=rithik.samanthula@gmail.com", "commit", "-q", "-m", f"Detector retrained on {len(train)} hand-checked photos"], cwd=ROOT)
    subprocess.run(["git", "push", "-q", "origin", "main"], cwd=ROOT)
    subprocess.run(["sh", os.path.join(HERE, "deploy.sh")], cwd=ROOT)


main()
