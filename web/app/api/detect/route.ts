import { NextRequest, NextResponse } from "next/server";
import { detectPoles, haveModel } from "@/lib/yolo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// FiberPath's pole detector (see lib/yolo.ts). There is deliberately no fallback model: a zero-shot detector
// found no poles at all on real street photos, and a silent "no poles" is worse than saying the model is not ready.

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
      const { boxes, candidates } = await detectPoles(Buffer.from(await r.arrayBuffer()), Math.max(0.05, Number(req.nextUrl.searchParams.get("t") ?? 0.25)));
      return NextResponse.json({ boxes, candidates: req.nextUrl.searchParams.get("debug") ? candidates : undefined, ms: Date.now() - t0, model: "FiberPath pole detector (YOLOv8n)" });
    }
    return NextResponse.json({ error: "The pole detector is still training and is not installed yet." }, { status: 503 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 200) }, { status: 500 });
  }
}
