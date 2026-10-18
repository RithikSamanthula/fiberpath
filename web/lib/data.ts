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
  poleSource: string;
  poleCount: number;
  grid: GridMeta;
  generated: string;
};

// status: 0 served, 1 underserved, 2 unserved
// tech: 0 none, 1 aerial fiber, 2 buried fiber, 3 fixed wireless
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
  depth: number; // plan cost-distance at which the home connects
  why: number; // 1 ridge, 2 trees, 3 no tower in range, 4 visible but fiber is cheaper
};

export type Tower = { id: number; lon: number; lat: number; kind: string; used: boolean; homes: number; reach: number };

export type County = {
  meta: Meta;
  homes: Home[];
  roads: [number, number][][];
  // lon1, lat1, lon2, lat2, class (1 aerial, 2 buried), cost-distance from hub, homes downstream
  plan: number[][];
  towers: Tower[];
  poles: [number, number, number][];
  elev: Int16Array;
  canopy: Uint8Array;
  hasGrids: boolean;
};

// Where the county files live. Set NEXT_PUBLIC_DATA_BASE to serve them from object storage or a CDN.
export const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE || "/data";

const cache = new Map<string, Promise<County>>();

// Everything but the terrain and canopy grids (about 5 MB), which only some screens need.
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

export function loadCounty(slug: string): Promise<County> {
  return loadCountyLite(slug).then(ensureGrids);
}

async function fetchCounty(slug: string): Promise<County> {
  const base = `${DATA_BASE}/${slug}`;
  const j = async (f: string) => {
    const r = await fetch(`${base}/${f}`);
    if (!r.ok) throw new Error(`Could not load ${f}`);
    return r.json();
  };
  const [meta, rawHomes, roads, plan, towers, poles] = await Promise.all([
    j("county.json"), j("homes.json"), j("roads.json"), j("plan.json"), j("towers.json"), j("poles.json"),
  ]);
  const homes: Home[] = (rawHomes as number[][]).map((r, i) => ({
    i, lon: r[0], lat: r[1], status: r[2], tech: r[3], cost: r[4], neighbors: r[5], tower: r[6],
    blockedTower: r[7], poles: r[8], dropFt: r[9], why: r[10], depth: r[11],
  }));
  return { meta, homes, roads, plan, towers, poles, elev: new Int16Array(0), canopy: new Uint8Array(0), hasGrids: false };
}

export const homeId = (h: { lat: number; lon: number }) => `${Math.round(h.lat * 1e5)}_${Math.round(h.lon * 1e5)}`;

export type IndexItem = {
  slug: string; name: string; state: string; geoid: string; bbox: [number, number, number, number];
  homes: number; unserved: number; reached: number; fiberHomes: number; wirelessHomes: number; towers: number;
  aerialFt: number; buriedFt: number; dropFt: number; assumptions: Assumptions; coverageSource: "fcc" | "proxy";
};

let indexP: Promise<IndexItem[]> | null = null;
export function loadIndex() {
  if (!indexP) indexP = fetch(`${DATA_BASE}/index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return indexP;
}
