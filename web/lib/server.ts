import fs from "fs/promises";
import os from "os";
import path from "path";
import { latLngToCell, cellToLatLng } from "h3-js";
import type { Home, Meta } from "./data";
import { homeId } from "./data";

let plansCache: { at: number; map: Record<string, string> } | null = null;
export async function plans(): Promise<Record<string, string>> {
  if (plansCache && Date.now() - plansCache.at < 60_000) return plansCache.map;
  try {
    const idx: { geoid: string; slug: string }[] = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "data", "index.json"), "utf8"));
    plansCache = { at: Date.now(), map: Object.fromEntries(idx.map((i) => [i.geoid, i.slug])) };
    return plansCache.map;
  } catch {
    return {};
  }
}

const dir = (slug: string) => path.join(process.cwd(), "public", "data", slug);
const mem = new Map<string, { meta: Meta; homes: Home[] }>();

export async function getPlan(slug: string) {
  let c = mem.get(slug);
  if (!c) {
    const meta: Meta = JSON.parse(await fs.readFile(path.join(dir(slug), "county.json"), "utf8"));
    const raw: number[][] = JSON.parse(await fs.readFile(path.join(dir(slug), "homes.json"), "utf8"));
    const homes: Home[] = raw.map((r, i) => ({
      i, lon: r[0], lat: r[1], status: r[2], tech: r[3], cost: r[4], neighbors: r[5], tower: r[6],
      blockedTower: r[7], poles: r[8], dropFt: r[9], why: r[10], depth: r[11],
    }));
    c = { meta, homes };
    mem.set(slug, c);
  }
  return c;
}

export function nearestHome(homes: Home[], lon: number, lat: number) {
  const ky = 110574, kx = 111320 * Math.cos((lat * Math.PI) / 180);
  let best: Home | null = null, bd = Infinity;
  for (const h of homes) {
    const d = Math.hypot((h.lon - lon) * kx, (h.lat - lat) * ky);
    if (d < bd) { bd = d; best = h; }
  }
  return { home: best, meters: bd };
}

// ---- demand pledges -------------------------------------------------------
// Stored per home id only. Nothing returned to the public includes an address.
// Uses Supabase if SUPABASE_URL and SUPABASE_SERVICE_KEY are set, else a local file.

type Pledge = { county: string; home: string; cell: string };
const sb = () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url, key } : null;
};
const file = () => process.env.PLEDGE_FILE || path.join(process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data"), "pledges.json");

async function readAll(county: string): Promise<Pledge[]> {
  const s = sb();
  if (s) {
    const r = await fetch(`${s.url}/rest/v1/pledges?county=eq.${county}&select=county,home,cell`, {
      headers: { apikey: s.key, Authorization: `Bearer ${s.key}` }, cache: "no-store",
    });
    if (!r.ok) throw new Error("pledge store unavailable");
    return r.json();
  }
  try {
    const all: Pledge[] = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file(), "utf8"));
    return all.filter((p) => p.county === county);
  } catch {
    return [];
  }
}

export async function addPledge(county: string, h: { lat: number; lon: number }, idOverride?: string) {
  const home = idOverride ?? homeId(h);
  const cell = latLngToCell(h.lat, h.lon, 8);
  const s = sb();
  if (s) {
    const r = await fetch(`${s.url}/rest/v1/pledges?on_conflict=county,home`, {
      method: "POST",
      headers: { apikey: s.key, Authorization: `Bearer ${s.key}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ county, home, cell }),
    });
    if (!r.ok) throw new Error("pledge store unavailable");
    return;
  }
  let all: Pledge[] = [];
  try { all = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file(), "utf8")); } catch {}
  if (!all.some((p) => p.county === county && p.home === home)) all.push({ county, home, cell });
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(file()), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ file(), JSON.stringify(all));
}

const MIN_CELL = 5; // a hexagon is only shown once it holds at least this many households

export async function demand(county: string) {
  const all = await readAll(county);
  return summarize(all);
}

export async function requestCount(geoid: string) {
  return (await readAll("request:" + geoid)).length;
}

function summarize(all: Pledge[]) {
  const by = new Map<string, number>();
  for (const p of all) by.set(p.cell, (by.get(p.cell) || 0) + 1);
  const cells = [...by].filter(([, n]) => n >= MIN_CELL).map(([c, n]) => {
    const [lat, lon] = cellToLatLng(c);
    return { lat, lon, count: n };
  });
  return { total: all.length, cells, minCell: MIN_CELL };
}
