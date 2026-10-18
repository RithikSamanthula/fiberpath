import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// Hand-checked photos. On a laptop they are appended to .data/labels.jsonl so nothing is lost if the browser is cleared.
// On a hosted copy the disk is temporary, so the Download button on the page is the reliable copy.
const file = () => path.join(process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data"), "labels.jsonl");

export async function POST(req: NextRequest) {
  let b: unknown;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  try {
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.appendFile(file(), JSON.stringify(b) + "\n");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save" }, { status: 503 });
  }
}
