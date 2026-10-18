import { NextResponse } from "next/server";
import { remoteIndex } from "@/lib/remote";

export const dynamic = "force-dynamic";

// Every county planned so far by the cloud pipeline, merged across states.
export async function GET() {
  const items = await remoteIndex();
  return NextResponse.json(items, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
}
