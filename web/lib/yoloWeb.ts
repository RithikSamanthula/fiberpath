"use client";
import type { Det } from "./poleLocate";

const MODEL = "/models/pole-640.onnx";
const S = 640;
let sessP: Promise<{ ort: typeof import("onnxruntime-web"); sess: import("onnxruntime-web").InferenceSession }> | null = null;
let canvas: HTMLCanvasElement | null = null;

export function loadModel() {
  if (!sessP) {
    sessP = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
      ort.env.wasm.numThreads = 1;
      const sess = await ort.InferenceSession.create(MODEL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return { ort, sess };
    })().catch((e) => { sessP = null; throw e; });
  }
  return sessP;
}

const iou = (a: Det, b: Det) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return i / (a.w * a.h + b.w * b.h - i || 1);
};

export async function detectFrame(src: CanvasImageSource, sw: number, sh: number, conf = 0.3): Promise<Det[]> {
  const { ort, sess } = await loadModel();
  canvas ??= Object.assign(document.createElement("canvas"), { width: S, height: S });
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const scale = Math.min(S / sw, S / sh);
  const nw = Math.round(sw * scale), nh = Math.round(sh * scale), px = Math.floor((S - nw) / 2), py = Math.floor((S - nh) / 2);
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(src, px, py, nw, nh);
  const d = ctx.getImageData(0, 0, S, S).data;
  const input = new Float32Array(3 * S * S);
  for (let i = 0, n = S * S; i < n; i++) { input[i] = d[i * 4] / 255; input[n + i] = d[i * 4 + 1] / 255; input[2 * n + i] = d[i * 4 + 2] / 255; }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) });
  const t = out[sess.outputNames[0]];
  const nch = t.dims[1], n = t.dims[2], data = t.data as Float32Array;
  const cand: Det[] = [];
  for (let i = 0; i < n; i++) {
    let cls = 0, score = 0;
    for (let k = 0; k < nch - 4; k++) { const v = data[(4 + k) * n + i]; if (v > score) { score = v; cls = k; } }
    if (score < conf) continue;
    const cx = data[i], cy = data[n + i], w = data[2 * n + i], h = data[3 * n + i];
    cand.push({ x: Math.max(0, (cx - w / 2 - px) / scale / sw), y: Math.max(0, (cy - h / 2 - py) / scale / sh), w: Math.min(1, w / scale / sw), h: Math.min(1, h / scale / sh), score, cls });
  }
  cand.sort((a, b) => b.score - a.score);
  const keep: Det[] = [];
  for (const c of cand) if (!keep.some((k) => iou(k, c) > 0.5)) keep.push(c);
  return keep;
}
