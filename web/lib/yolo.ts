import fs from "fs/promises";
import path from "path";

// FiberPath's trained utility-pole detector (YOLOv8n, exported to ONNX), run on the server with ONNX Runtime.
// Output rows are [cx, cy, w, h, confidence] for 8400 candidate boxes at 640x640.

export type Det = { x: number; y: number; w: number; h: number; score: number };

let sessionP: Promise<any> | null = null;
const modelPath = () => path.join(process.cwd(), "models", "pole.onnx");

export async function haveModel() {
  try { await fs.access(modelPath()); return true; } catch { return false; }
}

async function session() {
  if (!sessionP) {
    sessionP = (async () => {
      const ort = await import("onnxruntime-node");
      return ort.InferenceSession.create(modelPath());
    })().catch((e) => { sessionP = null; throw e; });
  }
  return sessionP;
}

export async function detectPoles(image: Buffer, conf = 0.25, iouThr = 0.5): Promise<Det[]> {
  const [ort, sharpMod, sess] = await Promise.all([import("onnxruntime-node"), import("sharp"), session()]);
  const sharp = sharpMod.default;
  const S = 640;
  const meta = await sharp(image).metadata();
  const W = meta.width ?? S, H = meta.height ?? S;
  const scale = Math.min(S / W, S / H);
  const nw = Math.round(W * scale), nh = Math.round(H * scale);
  const padX = Math.floor((S - nw) / 2), padY = Math.floor((S - nh) / 2);
  const raw = await sharp(image).resize(nw, nh).removeAlpha().raw().toBuffer();
  const input = new Float32Array(3 * S * S).fill(114 / 255);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const i = (y * nw + x) * 3, o = (y + padY) * S + (x + padX);
    input[o] = raw[i] / 255; input[S * S + o] = raw[i + 1] / 255; input[2 * S * S + o] = raw[i + 2] / 255;
  }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) });
  const t = out[sess.outputNames[0]];
  const n = t.dims[2], data = t.data as Float32Array;
  const cand: Det[] = [];
  for (let i = 0; i < n; i++) {
    const score = data[4 * n + i];
    if (score < conf) continue;
    const cx = data[i], cy = data[n + i], w = data[2 * n + i], h = data[3 * n + i];
    // undo the letterbox, then normalize to 0..1 of the original image
    const x = (cx - w / 2 - padX) / scale / W, y = (cy - h / 2 - padY) / scale / H;
    cand.push({ x: Math.max(0, x), y: Math.max(0, y), w: Math.min(1, w / scale / W), h: Math.min(1, h / scale / H), score });
  }
  cand.sort((a, b) => b.score - a.score);
  const keep: Det[] = [];
  const iou = (a: Det, b: Det) => {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return i / (a.w * a.h + b.w * b.h - i || 1);
  };
  for (const c of cand) if (!keep.some((k) => iou(k, c) > iouThr)) keep.push(c);
  return keep;
}
