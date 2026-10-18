import { NextRequest, NextResponse } from "next/server";
import { remoteAsset } from "@/lib/remote";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ geoid: string; part: string }> }) {
  const { geoid, part } = await ctx.params;
  if (part !== "pack" && part !== "grid") return new NextResponse("Not found", { status: 404 });
  const buf = await remoteAsset(geoid, part);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(buf, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
