import fs from "fs/promises";
import path from "path";
import { gunzipSync } from "zlib";
import { gridDisk, latLngToCell } from "h3-js";
import { REPO } from "./remote";

// Who reports broadband service near a point, from the FCC National Broadband Map (December 2025 release).
// One file per state, keyed by H3 hexagon (resolution 8, about 0.7 square km): provider, technology, fastest speeds.
type Row = [string, string, number, number, number]; // brand, technology, down, up, locations
const cache = new Map<string, Record<string, Row[]>>();

async function load(fips: string) {
  let m = cache.get(fips);
  if (m) return m;
  let buf: Buffer | null = null;
  try { buf = await fs.readFile(path.join(process.cwd(), "..", "pipeline", "data", "fcc-providers", `${fips}.json.gz`)); } catch {}
  if (!buf) {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/pipeline/data/fcc-providers/${fips}.json.gz`, { next: { revalidate: 86400 } });
    if (!r.ok) return null;
    buf = Buffer.from(await r.arrayBuffer());
  }
  m = JSON.parse(gunzipSync(buf).toString());
  if (cache.size >= 2) cache.delete(cache.keys().next().value as string);
  cache.set(fips, m!);
  return m!;
}

export type Offer = { brand: string; tech: string; down: number; up: number; here: boolean; homes: number };

export async function providersNear(lat: number, lon: number, fips: string): Promise<Offer[] | null> {
  const m = await load(fips);
  if (!m) return null;
  const here = latLngToCell(lat, lon, 8);
  const out = new Map<string, Offer>();
  for (const cell of gridDisk(here, 1)) {
    for (const [brand, tech, down, up, n] of m[cell] ?? []) {
      const k = `${brand}|${tech}`;
      const o = out.get(k) ?? { brand, tech, down: 0, up: 0, here: false, homes: 0 };
      o.down = Math.max(o.down, down); o.up = Math.max(o.up, up); o.homes += n; o.here = o.here || cell === here;
      out.set(k, o);
    }
  }
  return [...out.values()].sort((a, b) => Number(b.here) - Number(a.here) || b.down - a.down);
}
