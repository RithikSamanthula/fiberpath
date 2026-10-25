import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const UA = { "User-Agent": "FiberPath/0.1 (congressional app challenge)" };

async function overpass(q: string) {
  for (const base of OVERPASS) {
    try {
      const r = await fetch(base, { method: "POST", body: new URLSearchParams({ data: q }), headers: UA, signal: AbortSignal.timeout(14000), cache: "no-store" });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

function toXY(lat0: number) {
  const ky = 110574, kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return (lon: number, lat: number, lon0: number) => [(lon - lon0) * kx, (lat - lat0) * ky] as const;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const xy = toXY(lat);
  const r = 0.0045;
  const token = process.env.MAPILLARY_TOKEN;

  const [roads, bldg, places, poles] = await Promise.all([
    overpass(`[out:json][timeout:12];way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|trunk)$"](around:450,${lat},${lon});out geom;`),
    overpass(`[out:json][timeout:12];(way["building"](around:300,${lat},${lon}););out count;`),
    overpass(`[out:json][timeout:14];node["place"~"^(city|town|village)$"]["name"](around:40000,${lat},${lon});out;`),
    token
      ? fetch(`https://graph.mapillary.com/map_features?access_token=${token}&fields=id,geometry&object_values=object--support--utility-pole&bbox=${lon - r},${lat - r},${lon + r},${lat + r}`, { cache: "no-store", signal: AbortSignal.timeout(10000) }).then((x) => x.json()).catch(() => null)
      : Promise.resolve(null),
  ]);

  let roadM: number | null = null, roadName = "";
  const segs: [number, number, number, number][] = [];
  for (const w of roads?.elements ?? []) {
    const g = w.geometry as { lon: number; lat: number }[];
    for (let i = 0; i + 1 < g.length; i++) {
      const [ax, ay] = xy(g[i].lon, g[i].lat, lon), [bx, by] = xy(g[i + 1].lon, g[i + 1].lat, lon);
      const d = segDist(0, 0, ax, ay, bx, by);
      if (roadM === null || d < roadM) { roadM = d; roadName = w.tags?.name ?? ""; }
      segs.push([ax, ay, bx, by]);
    }
  }
  const poleList: [number, number][] = (poles?.data ?? []).map((f: any) => xy(f.geometry.coordinates[0], f.geometry.coordinates[1], lon) as [number, number]);
  let polesOnRoad = 0;
  for (const [px, py] of poleList) {
    for (const s of segs) {
      if (segDist(0, 0, s[0], s[1], s[2], s[3]) > 150) continue;
      if (segDist(px, py, s[0], s[1], s[2], s[3]) <= 45) { polesOnRoad++; break; }
    }
  }

  let town: { name: string; km: number; kind: string } | null = null;
  const rank: Record<string, number> = { city: 3, town: 2, village: 1 };
  for (const p of places?.elements ?? []) {
    const [x, y] = xy(p.lon, p.lat, lon);
    const km = Math.hypot(x, y) / 1000;
    const score = km / (1 + 0.5 * (rank[p.tags.place] ?? 1));
    const best = town ? town.km / (1 + 0.5 * (rank[town.kind] ?? 1)) : Infinity;
    if (score < best) town = { name: p.tags.name, km, kind: p.tags.place };
  }

  const homes = bldg?.elements?.[0]?.tags?.ways ? Number(bldg.elements[0].tags.ways) : null;
  return NextResponse.json({
    roadMeters: roadM === null ? null : Math.round(roadM),
    roadName,
    polesChecked: Boolean(token),
    polesOnRoad: token ? polesOnRoad : null,
    homesNearby: homes,
    town: town ? { ...town, km: Math.round(town.km * 10) / 10 } : null,
    partial: !roads || !places,
  });
}
