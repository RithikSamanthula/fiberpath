import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { remoteAsset, unpack } from "@/lib/remote";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const cache = new Map<string, number[][]>();

export async function GET(req: NextRequest) {
  const geoid = req.nextUrl.searchParams.get("geoid") ?? "";
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!/^\d{5}$/.test(geoid)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  let poles = cache.get(geoid);
  if (!poles) {
    try {
      if (/^[a-z0-9-]+$/.test(slug)) poles = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "data", slug, "poles.json"), "utf8"));
    } catch {}
    if (!poles) {
      const pack = await remoteAsset(geoid, "pack").catch(() => null);
      if (pack) poles = JSON.parse(unpack(pack)["poles.json"].toString());
    }
    if (poles) { if (cache.size > 20) cache.delete(cache.keys().next().value as string); cache.set(geoid, poles); }
  }
  const pts = (poles ?? []).filter((p) => p[2] === 0);
  if (!pts.length) return NextResponse.json({ error: "none" }, { status: 404 });
  const p = pts[Math.floor(Math.random() * pts.length)];
  return NextResponse.json({ lon: p[0], lat: p[1] });
}
