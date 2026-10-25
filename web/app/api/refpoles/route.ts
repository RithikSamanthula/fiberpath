import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) return NextResponse.json({ poles: [] });
  const lat = Number(req.nextUrl.searchParams.get("lat")), lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!isFinite(lat) || !isFinite(lon)) return NextResponse.json({ poles: [] });
  const r = 0.003;
  const j = await fetch(`https://graph.mapillary.com/map_features?access_token=${token}&fields=id,geometry&object_values=object--support--utility-pole&bbox=${lon - r},${lat - r},${lon + r},${lat + r}`, { cache: "no-store", signal: AbortSignal.timeout(15000) }).then((x) => x.json()).catch(() => null);
  return NextResponse.json({ poles: (j?.data ?? []).map((f: any) => f.geometry.coordinates) });
}
