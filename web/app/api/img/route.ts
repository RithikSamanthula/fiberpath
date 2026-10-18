import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Same-origin proxy for Mapillary photos so the in-browser detector can read their pixels.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  let url: URL;
  try { url = new URL(u); } catch { return new NextResponse("Bad request", { status: 400 }); }
  const ok = url.protocol === "https:" && (url.hostname.endsWith(".fbcdn.net") || url.hostname.endsWith(".mapillary.com"));
  if (!ok) return new NextResponse("Not allowed", { status: 400 });
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) return new NextResponse("Upstream error", { status: 502 });
  return new NextResponse(r.body, { headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}
