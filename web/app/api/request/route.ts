import { NextRequest, NextResponse } from "next/server";
import { addPledge, requestCount } from "@/lib/server";

export const dynamic = "force-dynamic";

// Ask for a full plan for a county that has not been planned yet.
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const { geoid, lat, lon, client } = b ?? {};
  if (typeof geoid !== "string" || !/^\d{5}$/.test(geoid) || typeof lat !== "number" || typeof lon !== "number" || typeof client !== "string" || client.length < 8 || client.length > 64)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    await addPledge("request:" + geoid, { lat, lon }, client);
    return NextResponse.json({ ok: true, requests: await requestCount(geoid) });
  } catch {
    return NextResponse.json({ error: "Could not save right now." }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const geoid = req.nextUrl.searchParams.get("geoid") ?? "";
  if (!/^\d{5}$/.test(geoid)) return NextResponse.json({ requests: 0 });
  return NextResponse.json({ requests: await requestCount(geoid).catch(() => 0) });
}
