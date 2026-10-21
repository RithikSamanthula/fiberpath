import { NextRequest, NextResponse } from "next/server";
import { hexTotals } from "@/lib/fccCoverage";
import { providersNear } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat")), lon = Number(req.nextUrl.searchParams.get("lon"));
  const fips = req.nextUrl.searchParams.get("state") ?? "";
  if (!isFinite(lat) || !isFinite(lon) || !/^\d{2}$/.test(fips)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const [offers, tot] = await Promise.all([providersNear(lat, lon, fips), hexTotals(lat, lon, fips).catch(() => null)]);
    if (!offers) return NextResponse.json({ available: false });
    return NextResponse.json({ available: true, release: "December 2025", total: tot ? tot[0] + tot[1] + tot[2] : null, unserved: tot ? tot[0] : null, offers: offers.slice(0, 12) }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json({ error: "Could not read the provider data" }, { status: 502 });
  }
}
