import { gunzipSync } from "zlib";
import type { IndexItem } from "./data";

export const REPO = process.env.DATA_REPO || "RithikSamanthula/fiberpath";
const BASE = process.env.REMOTE_BASE || `https://github.com/${REPO}/releases/download`;
const STATES = ["01","02","04","05","06","08","09","10","11","12","13","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","44","45","46","47","48","49","50","51","53","54","55","56","72"];

let cache: { at: number; items: IndexItem[] } | null = null;
const lastGood = new Map<string, IndexItem[]>();

export async function remoteIndex(maxAgeMs = 15_000): Promise<IndexItem[]> {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.items;
  const parts = await Promise.all(STATES.map(async (st) => {
    try {
      const r = await fetch(`${BASE}/data-${st}/index-${st}.json`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (r.ok) { const j = (await r.json()) as IndexItem[]; lastGood.set(st, j); return j; }
      return r.status === 404 ? (lastGood.get(st) ?? []) : (lastGood.get(st) ?? []);
    } catch { return lastGood.get(st) ?? []; }
  }));
  const items = parts.flat().map((i) => ({ ...i, remote: true }));
  cache = { at: Date.now(), items };
  return items;
}

export async function remoteAsset(geoid: string, part: "pack" | "grid"): Promise<ArrayBuffer | null> {
  if (!/^\d{5}$/.test(geoid)) return null;
  const r = await fetch(`${BASE}/data-${geoid.slice(0, 2)}/${geoid}-${part}.fpk`, { next: { revalidate: 300 } });
  return r.ok ? r.arrayBuffer() : null;
}

export function unpack(gz: ArrayBuffer): Record<string, Buffer> {
  const buf = gunzipSync(Buffer.from(gz));
  const hl = buf.readUInt32LE(0);
  const head: { n: string; len: number }[] = JSON.parse(buf.subarray(4, 4 + hl).toString());
  let off = 4 + hl;
  const out: Record<string, Buffer> = {};
  for (const h of head) { out[h.n] = buf.subarray(off, off + h.len); off += h.len; }
  return out;
}
