import fs from "fs/promises";
import path from "path";

export type Det = { x: number; y: number; w: number; h: number; score: number; cls: number };

let sessionP: Promise<any> | null = null;
let sessionStamp = 0;
const modelPath = () => path.join(process.cwd(), "models", "pole.onnx");
let sizeCache: { stamp: number; size: number } | null = null;

export async function haveModel() {
  try { await fs.access(modelPath()); return true; } catch { return false; }
}

async function session() {
  const stamp = (await fs.stat(modelPath())).mtimeMs;
  if (!sessionP || stamp !== sessionStamp) {
    sessionStamp = stamp;
    sizeCache = null;
    sessionP = (async () => {
      const ort = await import("onnxruntime-node");
      return ort.InferenceSession.create(modelPath());
    })().catch((e) => { sessionP = null; throw e; });
  }
  return sessionP;
}

async function inputSize(sess: any): Promise<number> {
  if (sizeCache && sizeCache.stamp === sessionStamp) return sizeCache.size;
  let size = 0;
  try {
    const meta = (sess.inputMetadata ?? [])[0] ?? sess.inputMetadata?.[sess.inputNames[0]];
    const shape: (number | string)[] | undefined = meta?.shape;
    if (shape && shape.length === 4 && typeof shape[2] === "number") size = shape[2] as number;
  } catch {}
  if (!size) {
    try { size = Number(JSON.parse(await fs.readFile(path.join(process.cwd(), "models", "pole.json"), "utf8")).imgsz) || 0; } catch {}
  }
  if (!size) {
    size = 640;
  }
  sizeCache = { stamp: sessionStamp, size };
  return size;
}

export async function detectPoles(image: Buffer, conf = 0.25, iouThr = 0.5): Promise<{ boxes: Det[]; candidates: Det[] }> {
  const [ort, sharpMod, sess] = await Promise.all([import("onnxruntime-node"), import("sharp"), session()]);
  const sharp = sharpMod.default;
  const S = await inputSize(sess);
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
  let out;
  try {
    out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) });
  } catch (e: any) {
    const m = /Expected:\s*(\d+)/.exec(String(e?.message ?? e));
    if (m && Number(m[1]) !== S) {
      sizeCache = { stamp: sessionStamp, size: Number(m[1]) };
      return detectPoles(image, conf, iouThr);
    }
    throw e;
  }
  const t = out[sess.outputNames[0]];
  const nch = t.dims[1], n = t.dims[2], data = t.data as Float32Array;
  const nc = nch - 4;
  const cand: Det[] = [];
  for (let i = 0; i < n; i++) {
    let cls = 0, score = 0;
    for (let k = 0; k < nc; k++) { const v = data[(4 + k) * n + i]; if (v > score) { score = v; cls = k; } }
    if (score < Math.min(conf, 0.1)) continue;
    const cx = data[i], cy = data[n + i], w = data[2 * n + i], h = data[3 * n + i];
    const x = (cx - w / 2 - padX) / scale / W, y = (cy - h / 2 - padY) / scale / H;
    cand.push({ x: Math.max(0, x), y: Math.max(0, y), w: Math.min(1, w / scale / W), h: Math.min(1, h / scale / H), score, cls });
  }
  cand.sort((a, b) => b.score - a.score);
  const iou = (a: Det, b: Det) => {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return i / (a.w * a.h + b.w * b.h - i || 1);
  };
  const keep: Det[] = [];
  for (const c of cand) {
    if (c.score < conf) continue;
    if (!keep.some((k) => iou(k, c) > iouThr)) keep.push(c);
  }
  return { boxes: keep, candidates: cand.slice(0, 90) };
}
