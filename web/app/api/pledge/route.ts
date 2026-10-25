import { NextRequest, NextResponse } from "next/server";
import { addPledge, demand, getPlan, nearestHome } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const { slug, geoid, lon, lat } = body ?? {};
  if (typeof lon !== "number" || typeof lat !== "number" || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    if (typeof slug === "string") {
      const { homes } = await getPlan(slug);
      const { home, meters } = nearestHome(homes, lon, lat);
      if (!home || meters > 250 || home.status === 0) return NextResponse.json({ error: "This home is not in an unserved area." }, { status: 422 });
      await addPledge(slug, home);
      return NextResponse.json({ ok: true, total: (await demand(slug)).total });
    }
    if (typeof geoid === "string" && /^\d{5}$/.test(geoid)) {
      const key = "area:" + geoid;
      await addPledge(key, { lat, lon });
      return NextResponse.json({ ok: true, total: (await demand(key)).total });
    }
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not save right now. Try again." }, { status: 503 });
  }
}
