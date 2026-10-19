import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Address suggestions while typing (Photon, built on OpenStreetMap). The Census service then does the real match on submit.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 4) return NextResponse.json({ items: [] });
  try {
    const u = new URL("https://photon.komoot.io/api/");
    u.searchParams.set("q", q);
    u.searchParams.set("limit", "10");
    u.searchParams.set("lang", "en");
    u.searchParams.set("bbox", "-179.2,17.5,-65,72");
    const r = await fetch(u, { headers: { "User-Agent": "FiberPath/0.1 (rithik.samanthula@gmail.com)" }, signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const seen = new Set<string>();
    const items: string[] = [];
    for (const f of j.features ?? []) {
      const p = f.properties ?? {};
      if (p.countrycode !== "US" || !p.state) continue;
      const street = p.street ? `${p.housenumber ? p.housenumber + " " : ""}${p.street}` : p.name;
      if (!street) continue;
      const s = [street, p.city || p.county, `${p.state}${p.postcode ? " " + p.postcode : ""}`].filter(Boolean).join(", ");
      if (!seen.has(s)) { seen.add(s); items.push(s); }
      if (items.length >= 6) break;
    }
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
