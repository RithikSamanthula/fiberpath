export type Assumptions = {
  aerialPerFt: number;
  buriedPerFt: number;
  dropBase: number;
  dropPerFt: number;
  towerEach: number;
  wirelessCpe: number;
};

export type Totals = {
  homesAll: number;
  unserved: number;
  fiberHomes: number;
  wirelessHomes: number;
  unreached: number;
  towers: number;
  aerialFt: number;
  buriedFt: number;
  dropFt: number;
};

export type GridMeta = {
  w: number;
  n: number;
  dlon: number;
  dlat: number;
  nx: number;
  ny: number;
  elevScale: number;
  canopyScale: number;
};

export type Meta = {
  slug: string;
  name: string;
  state: string;
  geoid: string;
  bbox: [number, number, number, number];
  hub: [number, number];
  boundary: [number, number][];
  assumptions: Assumptions;
  totals: Totals;
  benchmark: { name: string; total: number; homes: number; per_home: number; grant: number } | null;
  coverageSource: "fcc" | "proxy";
  planVersion?: number;
  poleSource: string;
  poleCount: number;
  grid: GridMeta;
  generated: string;
};

export type Home = {
  i: number;
  lon: number;
  lat: number;
  status: number;
  tech: number;
  cost: number;
  neighbors: number;
  tower: number;
  blockedTower: number;
  poles: number;
  dropFt: number;
  depth: number;
  why: number;
};

export type Tower = { id: number; lon: number; lat: number; kind: string; used: boolean; homes: number; reach: number };

export type County = {
  meta: Meta;
  homes: Home[];
  roads: [number, number][][];
  plan: number[][];
  towers: Tower[];
  poles: [number, number, number][];
  elev: Int16Array;
  canopy: Uint8Array;
  hasGrids: boolean;
};

export const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE || "/data";

const cache = new Map<string, Promise<County>>();

export function loadCountyLite(slug: string): Promise<County> {
  let p = cache.get(slug);
  if (!p) {
    p = fetchCounty(slug);
    cache.set(slug, p);
  }
  return p;
}

export async function ensureGrids(d: County): Promise<County> {
  if (d.hasGrids) return d;
  const item = (await loadIndex()).find((i) => i.slug === d.meta.slug);
  if (item?.remote) {
    const f = await unpack(await fetch(`/api/data/${item.geoid}/grid`));
    d.elev = new Int16Array(f["elev.bin"].buffer);
    d.canopy = new Uint8Array(f["canopy.bin"]);
    d.hasGrids = true;
    return d;
  }
  const b = async (f: string) => {
    const r = await fetch(`${DATA_BASE}/${d.meta.slug}/${f}`);
    if (!r.ok) throw new Error(`Could not load ${f}`);
    return r.arrayBuffer();
  };
  const [e, c] = await Promise.all([b("elev.bin"), b("canopy.bin")]);
  d.elev = new Int16Array(e);
  d.canopy = new Uint8Array(c);
  d.hasGrids = true;
  return d;
}

export function warmGrids(slug: string) {
  loadCountyLite(slug).then(ensureGrids).catch(() => {});
}

export function loadCounty(slug: string): Promise<County> {
  return loadCountyLite(slug).then(ensureGrids);
}

async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unpack(res: Response): Promise<Record<string, Uint8Array>> {
  if (!res.ok) throw new Error("Could not load this county yet");
  const u = await gunzip(await res.arrayBuffer());
  const hl = new DataView(u.buffer, u.byteOffset).getUint32(0, true);
  const head: { n: string; len: number }[] = JSON.parse(new TextDecoder().decode(u.subarray(4, 4 + hl)));
  const out: Record<string, Uint8Array> = {};
  let off = 4 + hl;
  for (const h of head) { out[h.n] = u.slice(off, off + h.len); off += h.len; }
  return out;
}

const json = (u: Uint8Array) => JSON.parse(new TextDecoder().decode(u));

function build(meta: Meta, rawHomes: number[][], roads: County["roads"], plan: number[][], towers: Tower[], poles: County["poles"]): County {
  const homes: Home[] = rawHomes.map((r, i) => ({
    i, lon: r[0], lat: r[1], status: r[2], tech: r[3], cost: r[4], neighbors: r[5], tower: r[6],
    blockedTower: r[7], poles: r[8], dropFt: r[9], why: r[10], depth: r[11],
  }));
  return { meta, homes, roads, plan, towers, poles, elev: new Int16Array(0), canopy: new Uint8Array(0), hasGrids: false };
}

async function fetchCounty(slug: string): Promise<County> {
  const item = (await loadIndex()).find((i) => i.slug === slug);
  if (item?.remote) {
    let res = await fetch(`${DATA_BASE}/packs/${item.geoid}.fpk`).catch(() => null);
    if (!res?.ok || /html/.test(res.headers.get("content-type") ?? "")) res = await fetch(`/api/data/${item.geoid}/pack`);
    const f = await unpack(res);
    const meta = json(f["county.json"]);
    meta.slug = item.slug;
    return build(meta, json(f["homes.json"]), json(f["roads.json"]), json(f["plan.json"]), json(f["towers.json"]), json(f["poles.json"]));
  }
  const base = `${DATA_BASE}/${slug}`;
  const j = async (f: string) => {
    const r = await fetch(`${base}/${f}`);
    if (!r.ok) throw new Error(`Could not load ${f}`);
    return r.json();
  };
  const [meta, rawHomes, roads, plan, towers, poles] = await Promise.all([
    j("county.json"), j("homes.json"), j("roads.json"), j("plan.json"), j("towers.json"), j("poles.json"),
  ]);
  return build(meta, rawHomes, roads, plan, towers, poles);
}

export const homeId = (h: { lat: number; lon: number }) => `${Math.round(h.lat * 1e5)}_${Math.round(h.lon * 1e5)}`;

export type IndexItem = {
  slug: string; name: string; state: string; geoid: string; bbox: [number, number, number, number];
  homes: number; unserved: number; reached: number; fiberHomes: number; wirelessHomes: number; towers: number;
  aerialFt: number; buriedFt: number; dropFt: number; assumptions: Assumptions; coverageSource: "fcc" | "proxy"; planVersion?: number;
  plannedAt?: string;
  remote?: boolean;
};

let staticIdx: Promise<IndexItem[]> | null = null;
let merged: IndexItem[] | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(i: IndexItem[]) => void>();

function mergeIdx(a: IndexItem[], b: IndexItem[]) {
  const m = new Map<string, IndexItem>();
  for (const i of a) m.set(i.geoid, i);
  const rank = (x: IndexItem) => (x.coverageSource === "fcc" ? 10 : 0) + (x.planVersion ?? 1);
  for (const i of b) { const o = m.get(i.geoid); if (!o || rank(i) >= rank(o)) m.set(i.geoid, i); }
  const out = [...m.values()];
  const n = new Map<string, number>();
  for (const i of out) n.set(i.slug, (n.get(i.slug) ?? 0) + 1);
  return out.map((i) => (n.get(i.slug)! > 1 && !/county|parish|borough/i.test(i.name) ? { ...i, slug: `${i.slug}-${/ city$/i.test(i.name) ? "city" : i.geoid}` } : i));
}

async function refresh() {
  staticIdx ??= fetch(`${DATA_BASE}/index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const [st, live] = await Promise.all([staticIdx, fetch("/api/index").then((r) => (r.ok ? r.json() : [])).catch(() => [])]);
  const next = mergeIdx(st as IndexItem[], live as IndexItem[]);
  if (!merged || next.length !== merged.length || next.some((n, k) => n.plannedAt !== merged![k]?.plannedAt || n.geoid !== merged![k]?.geoid)) {
    merged = next;
    listeners.forEach((f) => f(next));
  }
  return merged;
}

export function subscribeIndex(f: (i: IndexItem[]) => void) {
  listeners.add(f);
  if (merged) f(merged);
  if (!timer) {
    refresh();
    timer = setInterval(refresh, 20_000);
  }
  return () => {
    listeners.delete(f);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}

export function loadIndex(): Promise<IndexItem[]> {
  return merged ? Promise.resolve(merged) : refresh();
}
