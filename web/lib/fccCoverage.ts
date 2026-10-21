import fs from "fs/promises";
import path from "path";
import { gunzipSync } from "zlib";
import { gridDisk, latLngToCell } from "h3-js";
import { REPO } from "./remote";

// FCC National Broadband Map coverage per H3 hexagon, from pipeline/fcc_bdc.py: locations unserved, underserved, served.
const cache = new Map<string, Map<string, [number, number, number]>>();

async function load(fips: string) {
  let m = cache.get(fips);
  if (m) return m;
  let buf: Buffer | null = null;
  try { buf = await fs.readFile(path.join(process.cwd(), "..", "pipeline", "data", `state-${fips}-fcc-h3.csv.gz`)); } catch {}
  if (!buf) {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/pipeline/data/state-${fips}-fcc-h3.csv.gz`, { next: { revalidate: 86400 } });
    if (!r.ok) return null;
    buf = Buffer.from(await r.arrayBuffer());
  }
  m = new Map();
  for (const line of gunzipSync(buf).toString().split("\n").slice(1)) {
    const [h, u, un, s] = line.split(",");
    if (h) m.set(h, [+u, +un, +s]);
  }
  if (cache.size >= 2) cache.delete(cache.keys().next().value as string);
  cache.set(fips, m);
  return m;
}

// how many locations the FCC counts in the home's own hexagon: [unserved, underserved, served]
export async function hexTotals(lat: number, lon: number, fips: string): Promise<[number, number, number] | null> {
  const m = await load(fips);
  return m?.get(latLngToCell(lat, lon, 8)) ?? null;
}

// 0 served, 1 underserved, 2 unserved: the most common tier among the locations in the home's hexagon (as in the plan)
export async function fccStatus(lat: number, lon: number, fips: string): Promise<number | null> {
  const m = await load(fips);
  if (!m) return null;
  const here = latLngToCell(lat, lon, 8);
  for (const cells of [[here], gridDisk(here, 1)]) {
    const t = [0, 0, 0];
    for (const c of cells) { const v = m.get(c); if (v) { t[0] += v[0]; t[1] += v[1]; t[2] += v[2]; } }
    const max = Math.max(...t);
    if (max > 0) return t[2] === max ? 0 : t[1] === max ? 1 : 2;
  }
  return null;
}
