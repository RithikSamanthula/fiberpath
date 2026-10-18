import { NextRequest, NextResponse } from "next/server";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const G = "https://graph.mapillary.com";

async function boxesFor(id: string, token: string) {
  const dr = await fetch(`${G}/${id}/detections?access_token=${token}&fields=value,geometry`, { cache: "no-store", signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!dr || !dr.ok) return [];
  const dets: any[] = (await dr.json()).data ?? [];
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const d of dets) {
    if (d.value !== "object--support--utility-pole") continue;
    try {
      const tile = new VectorTile(new PbfReader(new Uint8Array(Buffer.from(d.geometry, "base64"))));
      const layer = Object.values(tile.layers)[0];
      const ring = layer.feature(0).loadGeometry()[0];
      const xs = ring.map((p) => p.x / layer.extent), ys = ring.map((p) => p.y / layer.extent);
      boxes.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    } catch {}
  }
  return boxes;
}

// Street photos near a point (nearest first), each with Mapillary's own pole detections as a reference.
export async function GET(req: NextRequest) {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) return NextResponse.json({ configured: false });
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const n = Math.min(8, Math.max(1, Number(req.nextUrl.searchParams.get("n") ?? 6)));
  if (!isFinite(lat) || !isFinite(lon)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = 0.0012;
  const ir = await fetch(
    `${G}/images?access_token=${token}&fields=id,thumb_1024_url,computed_geometry,captured_at,is_pano&limit=40&bbox=${lon - r},${lat - r},${lon + r},${lat + r}`,
    { cache: "no-store", signal: AbortSignal.timeout(15000) },
  ).catch(() => null);
  if (!ir || !ir.ok) return NextResponse.json({ configured: true, error: "Mapillary did not respond." }, { status: 502 });
  const imgs: any[] = ((await ir.json()).data ?? []).filter((i: any) => i.thumb_1024_url && !i.is_pano && i.computed_geometry);
  const ky = 110574, kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const dist = (i: any) => Math.hypot((i.computed_geometry.coordinates[0] - lon) * kx, (i.computed_geometry.coordinates[1] - lat) * ky);
  imgs.sort((a, b) => dist(a) - dist(b));
  // spread the picks along the road instead of taking five frames from the same second
  const picks: any[] = [];
  for (const i of imgs) {
    if (picks.length >= n) break;
    const [x, y] = i.computed_geometry.coordinates;
    if (picks.every((p) => Math.hypot((p.computed_geometry.coordinates[0] - x) * kx, (p.computed_geometry.coordinates[1] - y) * ky) > 18)) picks.push(i);
  }
  const images = await Promise.all(picks.map(async (i) => ({
    id: i.id, url: i.thumb_1024_url, capturedAt: i.captured_at, lon: i.computed_geometry.coordinates[0], lat: i.computed_geometry.coordinates[1],
    meters: Math.round(dist(i)), boxes: await boxesFor(i.id, token),
  })));
  return NextResponse.json({ configured: true, images });
}
