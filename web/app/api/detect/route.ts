import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import { detectPoles, haveModel } from "@/lib/yolo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// FiberPath's own pole detector: OWL-ViT (open-vocabulary object detection) run with ONNX Runtime.
// The model downloads once on first use and stays warm between requests.
const LABELS = ["a utility pole", "a wooden telephone pole with wires", "a tree trunk", "a street light", "a road sign"];
const POLE = new Set(LABELS.slice(0, 2));

let det: Promise<any> | null = null;
async function detector() {
  if (!det) {
    det = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = path.join(os.tmpdir(), "fiberpath-models");
      return pipeline("zero-shot-object-detection", "Xenova/owlvit-base-patch32", { dtype: "uint8" } as any);
    })().catch((e) => { det = null; throw e; });
  }
  return det;
}

type B = { x: number; y: number; w: number; h: number; score: number };
const iou = (a: B, b: B) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return i / (a.w * a.h + b.w * b.h - i || 1);
};

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const threshold = Number(req.nextUrl.searchParams.get("t") ?? 0.12);
  let url: URL;
  try { url = new URL(u); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (url.protocol !== "https:" || !(url.hostname.endsWith(".fbcdn.net") || url.hostname.endsWith(".mapillary.com"))) return NextResponse.json({ error: "Not allowed" }, { status: 400 });
  try {
    if (await haveModel()) {
      const t0 = Date.now();
      const r = await fetch(url, { cache: "no-store" });
      const boxes = await detectPoles(Buffer.from(await r.arrayBuffer()), Math.max(0.05, Number(req.nextUrl.searchParams.get("t") ?? 0.25)));
      return NextResponse.json({ boxes, ms: Date.now() - t0, model: "FiberPath pole detector (YOLOv8n)" });
    }
    const t0 = Date.now();
    const [{ RawImage }, d] = await Promise.all([import("@huggingface/transformers"), detector()]);
    const img = await RawImage.fromURL(url.toString());
    const out: any[] = await d(img, LABELS, { threshold: 0.05, percentage: true });
    const box = (o: any): B => ({ score: o.score, x: o.box.xmin, y: o.box.ymin, w: o.box.xmax - o.box.xmin, h: o.box.ymax - o.box.ymin });
    const others = out.filter((o) => !POLE.has(o.label) && o.score >= threshold).map(box);
    const poles = out.filter((o) => POLE.has(o.label) && o.score >= threshold).map(box)
      .filter((b) => !others.some((o) => o.score > b.score && iou(b, o) > 0.5))
      .sort((a, b) => b.score - a.score);
    const kept: B[] = [];
    for (const b of poles) if (!kept.some((k) => iou(k, b) > 0.4)) kept.push(b);
    return NextResponse.json({ boxes: kept, ms: Date.now() - t0, model: "OWL-ViT base (ONNX, 8-bit)" });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 200) }, { status: 500 });
  }
}
