import { NextRequest, NextResponse } from "next/server";
import { fccStatus } from "@/lib/fccCoverage";
import { getPlan, nearestHome, plans, requestCount } from "@/lib/server";

export const dynamic = "force-dynamic";

async function acs(g: any) {
  const key = process.env.CENSUS_API_KEY;
  const bg = g?.["Census Block Groups"]?.[0];
  if (!key || !bg) return null;
  try {
    const u = `https://api.census.gov/data/2023/acs/acs5?get=B28002_001E,B28002_013E&for=block%20group:${bg.BLKGRP}&in=state:${bg.STATE}%20county:${bg.COUNTY}%20tract:${bg.TRACT}&key=${key}`;
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) return null;
    const rows = await r.json();
    const total = Number(rows[1][0]), none = Number(rows[1][1]);
    return total > 0 ? { households: total, noInternetPct: Math.round((none / total) * 1000) / 10 } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address || address.length < 5) return NextResponse.json({ error: "Enter a street address with a city or ZIP." }, { status: 400 });

  const u = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
  u.searchParams.set("address", address);
  u.searchParams.set("benchmark", "Public_AR_Current");
  u.searchParams.set("vintage", "Current_Current");
  u.searchParams.set("format", "json");
  let j: any;
  try {
    const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    j = await r.json();
  } catch {
    return NextResponse.json({ error: "The Census address service did not respond. Try again in a moment." }, { status: 502 });
  }
  const m = j?.result?.addressMatches?.[0];
  if (!m) return NextResponse.json({ error: "No match for that address. Include the city and state or ZIP code." }, { status: 404 });

  const geo = m.geographies;
  const county = geo?.Counties?.[0];
  const out: any = {
    matched: m.matchedAddress,
    lon: m.coordinates.x,
    lat: m.coordinates.y,
    county: county ? { name: county.NAME, geoid: county.GEOID, state: geo?.States?.[0]?.STUSAB ?? "" } : null,
    planned: false,
  };
  out.acs = await acs(geo);

  const fcc = county ? await fccStatus(out.lat, out.lon, county.GEOID.slice(0, 2)).catch(() => null) : null;
  out.fccStatus = fcc;
  const slug = county ? (await plans())[county.GEOID] : undefined;
  out.requests = county ? await requestCount(county.GEOID).catch(() => 0) : 0;
  if (slug) {
    const { meta, homes } = await getPlan(slug);
    const { home, meters } = nearestHome(homes, out.lon, out.lat);
    if (home && meters <= 250) {
      out.planned = true;
      out.slug = slug;
      out.home = home;
      out.homeMeters = Math.round(meters);
      out.coverageSource = meta.coverageSource;
      // plans made before the FCC data was loaded still get the real answer for the address itself
      if (fcc !== null && meta.coverageSource !== "fcc") { out.home = { ...home, status: fcc }; out.coverageSource = "fcc"; out.replanning = true; }
      out.towers = null;
    } else {
      out.planned = true;
      out.slug = slug;
      out.home = null;
    }
  }
  return NextResponse.json(out);
}
