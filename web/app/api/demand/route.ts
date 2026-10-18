import { NextRequest, NextResponse } from "next/server";
import { demand } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("county") ?? "towns-ga";
  try {
    return NextResponse.json(await demand(slug));
  } catch {
    return NextResponse.json({ total: 0, cells: [], minCell: 5, unavailable: true });
  }
}
