import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ABBR: Record<string, string> = {
  st: "street", rd: "road", dr: "drive", ave: "avenue", av: "avenue", ln: "lane", hwy: "highway", blvd: "boulevard", ct: "court", cir: "circle",
  pkwy: "parkway", pl: "place", trl: "trail", ter: "terrace", n: "north", s: "south", e: "east", w: "west", ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
  mt: "mount", ft: "fort",
};
const STATES: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado", ct: "connecticut", de: "delaware", dc: "district", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa", ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland", ma: "massachusetts",
  mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada", nh: "new", nj: "new", nm: "new", ny: "new", nc: "north",
  nd: "north", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode", sc: "south", sd: "south", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west", wi: "wisconsin", wy: "wyoming", pr: "puerto",
};
const norm = (s: string) => s.toLowerCase().replace(/[.,#]/g, " ").split(/\s+/).filter(Boolean);

// Every word the person typed has to appear (as the start of a word) in the suggestion, and a house number has to match exactly
function relevant(typed: string[], text: string) {
  const words = norm(text);
  return typed.every((t) => {
    if (/^\d+$/.test(t)) return words.includes(t) || words.some((w) => w.startsWith(t) && !/^\d+$/.test(w.slice(t.length) || "x"));
    const alts = [t, ABBR[t], STATES[t]].filter(Boolean) as string[];
    return words.some((w) => alts.some((a) => w.startsWith(a)));
  });
}

async function photon(q: string, lat: number | null, lon: number | null) {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "20");
  u.searchParams.set("lang", "en");
  u.searchParams.append("layer", "house");
  u.searchParams.append("layer", "street");
  u.searchParams.set("bbox", "-179.2,17.5,-65,72");
  if (lat !== null && lon !== null) { u.searchParams.set("lat", String(lat)); u.searchParams.set("lon", String(lon)); u.searchParams.set("location_bias_scale", "0.4"); }
  const r = await fetch(u, { headers: { "User-Agent": "FiberPath/0.1 (rithik.samanthula@gmail.com)" }, signal: AbortSignal.timeout(6000) });
  const j = await r.json();
  const out: string[] = [];
  for (const f of j.features ?? []) {
    const p = f.properties ?? {};
    if (p.countrycode !== "US" || !p.state || !p.street) continue;
    out.push([`${p.housenumber ? p.housenumber + " " : ""}${p.street}`, p.city || p.county, `${p.state}${p.postcode ? " " + p.postcode : ""}`].filter(Boolean).join(", "));
  }
  return out;
}

// The Census geocoder is what the address check uses, so an address it can match is guaranteed to work
async function census(q: string) {
  const u = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  u.searchParams.set("address", q);
  u.searchParams.set("benchmark", "Public_AR_Current");
  u.searchParams.set("format", "json");
  const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
  const j = await r.json();
  return (j?.result?.addressMatches ?? []).slice(0, 2).map((m: { matchedAddress: string }) =>
    m.matchedAddress.toLowerCase().replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b).replace(/\b(Ga|Nc|Sc|Tn|Al|Fl|Va|Wv|Ky|Oh|Ny|Pa|Tx|Ca)\b/g, (s: string) => s.toUpperCase()).replace(/, (\w\w), (\d{5})/, ", $1 $2"));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 4) return NextResponse.json({ items: [] });
  const typed = norm(q);
  const lat = Number(req.headers.get("x-vercel-ip-latitude")), lon = Number(req.headers.get("x-vercel-ip-longitude"));
  const [ph, ce] = await Promise.allSettled([photon(q, lat ? lat : null, lon ? lon : null), typed.length >= 3 && /^\d/.test(typed[0]) ? census(q) : Promise.resolve([])]);
  const seen = new Set<string>();
  const items: string[] = [];
  const add = (s: string) => { const k = s.toLowerCase().replace(/[^a-z0-9]/g, ""); if (!seen.has(k)) { seen.add(k); items.push(s); } };
  if (ce.status === "fulfilled") for (const s of ce.value) add(s);
  if (ph.status === "fulfilled") for (const s of ph.value) if (relevant(typed, s)) add(s);
  return NextResponse.json({ items: items.slice(0, 6) }, { headers: { "Cache-Control": "public, s-maxage=600" } });
}
