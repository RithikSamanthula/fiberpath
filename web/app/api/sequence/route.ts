import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const G = "https://graph.mapillary.com";
const FIELDS = "id,computed_rotation,computed_geometry,computed_compass_angle,compass_angle,camera_type,camera_parameters,width,height,sequence,captured_at,thumb_1024_url,is_pano";

export async function GET(req: NextRequest) {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) return NextResponse.json({ configured: false });
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const n = Math.min(40, Math.max(6, Number(req.nextUrl.searchParams.get("n") ?? 24)));
  if (!isFinite(lat) || !isFinite(lon)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const ky = 110574, kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const r = 0.0026;
  const ir = await fetch(`${G}/images?access_token=${token}&fields=${FIELDS}&limit=300&bbox=${lon - r},${lat - r},${lon + r},${lat + r}`, { cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!ir || !ir.ok) return NextResponse.json({ configured: true, error: "Mapillary did not respond." }, { status: 502 });
  const all: any[] = ((await ir.json()).data ?? []).filter((i: any) => i.computed_geometry && i.thumb_1024_url && !i.is_pano && i.camera_parameters && i.width && i.computed_rotation);
  const xy = (i: any) => [(i.computed_geometry.coordinates[0] - lon) * kx, (i.computed_geometry.coordinates[1] - lat) * ky];
  const dist = (i: any) => Math.hypot(...(xy(i) as [number, number]));
  const bySeq = new Map<string, any[]>();
  for (const i of all) (bySeq.get(i.sequence) ?? bySeq.set(i.sequence, []).get(i.sequence)!).push(i);
  let best: any[] = [], score = -1;
  for (const [, v] of bySeq) {
    const near = Math.min(...v.map(dist));
    const s = v.length / (1 + near / 15) - near / 40;
    if (v.length >= 4 && s > score) { score = s; best = v; }
  }
  if (!best.length) return NextResponse.json({ configured: true, frames: [] });
  best.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
  const thin: any[] = [];
  for (const i of best) {
    const [x, y] = xy(i);
    const last = thin[thin.length - 1];
    if (!last || Math.hypot(x - xy(last)[0], y - xy(last)[1]) >= 7) thin.push(i);
  }
  const ci = thin.reduce((b, i, k) => (dist(i) < dist(thin[b]) ? k : b), 0);
  const start = Math.max(0, Math.min(thin.length - n, ci - Math.floor(n / 2)));
  const frames = thin.slice(start, start + n).map((i) => ({
    id: i.id, lon: i.computed_geometry.coordinates[0], lat: i.computed_geometry.coordinates[1],
    heading: i.computed_compass_angle ?? i.compass_angle, focal: i.camera_parameters[0], w: i.width, h: i.height,
    rot: i.computed_rotation, k: [i.camera_parameters[1] ?? 0, i.camera_parameters[2] ?? 0], type: i.camera_type, url: i.thumb_1024_url, capturedAt: i.captured_at, sequence: i.sequence,
  }));
  return NextResponse.json({ configured: true, frames });
}
