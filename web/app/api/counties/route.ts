import { NextRequest, NextResponse } from "next/server";
import { plans } from "@/lib/server";

export const dynamic = "force-dynamic";

// Every county in a state (Census TIGERweb), marked with whether FiberPath has a plan for it.
export async function GET(req: NextRequest) {
  const st = req.nextUrl.searchParams.get("state") ?? "";
  if (!/^\d{2}$/.test(st)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const u = new URL("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query");
  u.searchParams.set("where", `STATE='${st}'`);
  u.searchParams.set("outFields", "NAME,GEOID,CENTLAT,CENTLON");
  u.searchParams.set("returnGeometry", "false");
  u.searchParams.set("orderByFields", "NAME");
  u.searchParams.set("resultRecordCount", "300");
  u.searchParams.set("f", "json");
  try {
    const r = await fetch(u, { next: { revalidate: 86400 } });
    const j = await r.json();
    const p = await plans();
    const counties = (j.features ?? []).map((f: any) => ({
      name: f.attributes.NAME, geoid: f.attributes.GEOID, lat: Number(f.attributes.CENTLAT), lon: Number(f.attributes.CENTLON), slug: p[f.attributes.GEOID] ?? null,
    }));
    return NextResponse.json({ counties });
  } catch {
    return NextResponse.json({ error: "The Census service did not respond." }, { status: 502 });
  }
}
