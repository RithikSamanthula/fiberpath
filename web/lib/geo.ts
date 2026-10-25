import type { County } from "./data";

export const FT = 3.28084;

export function metersPerDeg(lat: number) {
  return { kx: 111320 * Math.cos((lat * Math.PI) / 180), ky: 110574 };
}

export function distM(lon1: number, lat1: number, lon2: number, lat2: number) {
  const { kx, ky } = metersPerDeg((lat1 + lat2) / 2);
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * ky);
}

function bilinear(a: Float32Array | Int16Array | Uint8Array, nx: number, ny: number, r: number, c: number, scale: number) {
  r = Math.min(Math.max(r, 0), ny - 1);
  c = Math.min(Math.max(c, 0), nx - 1);
  const r0 = Math.floor(r), c0 = Math.floor(c);
  const r1 = Math.min(r0 + 1, ny - 1), c1 = Math.min(c0 + 1, nx - 1);
  const fr = r - r0, fc = c - c0;
  const v =
    a[r0 * nx + c0] * (1 - fr) * (1 - fc) +
    a[r0 * nx + c1] * (1 - fr) * fc +
    a[r1 * nx + c0] * fr * (1 - fc) +
    a[r1 * nx + c1] * fr * fc;
  return v / scale;
}

export function sampleElev(d: County, lon: number, lat: number) {
  const g = d.meta.grid;
  return bilinear(d.elev, g.nx, g.ny, (g.n - lat) / g.dlat, (lon - g.w) / g.dlon, g.elevScale);
}

export function sampleCanopy(d: County, lon: number, lat: number) {
  const g = d.meta.grid;
  return bilinear(d.canopy, g.nx, g.ny, (g.n - lat) / g.dlat, (lon - g.w) / g.dlon, g.canopyScale);
}

export const LOS = { towerH: 25, homeH: 6, freq: 5.8e9, fresnel: 0.6, k: 4 / 3, R: 6371000, n: 300, endSkip: 30 };

export type Profile = {
  dist: number;
  d: number[];
  ground: number[];
  surface: number[];
  line: number[];
  lower: number[];
  clear: number[];
  worst: number;
  margin: number;
  blockedByTerrain: boolean;
  visible: boolean;
};

export function profile(d: County, a: { lon: number; lat: number }, b: { lon: number; lat: number }): Profile {
  const dist = distM(a.lon, a.lat, b.lon, b.lat);
  const lambda = 299792458 / LOS.freq;
  const N = LOS.n;
  const ds: number[] = [], ground: number[] = [], surface: number[] = [], line: number[] = [], lower: number[] = [], clear: number[] = [];
  const lonAt = (f: number) => a.lon + (b.lon - a.lon) * f;
  const latAt = (f: number) => a.lat + (b.lat - a.lat) * f;
  const g0 = sampleElev(d, a.lon, a.lat) + LOS.towerH;
  const g1 = sampleElev(d, b.lon, b.lat) + LOS.homeH;
  let worst = 0, margin = Infinity, terrainMargin = Infinity;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const lon = lonAt(f), lat = latAt(f);
    const gr = sampleElev(d, lon, lat);
    const tr = sampleCanopy(d, lon, lat);
    const d1 = dist * f, d2 = dist * (1 - f);
    const bulge = (d1 * d2) / (2 * LOS.k * LOS.R);
    const ln = g0 + (g1 - g0) * f;
    const r1 = Math.sqrt((lambda * d1 * d2) / Math.max(dist, 1));
    const low = ln - LOS.fresnel * r1;
    const skip = d1 < LOS.endSkip || d2 < LOS.endSkip;
    const c = skip ? 1e3 : low - (gr + tr + bulge);
    const ct = skip ? 1e3 : low - (gr + bulge);
    ds.push(d1);
    ground.push(gr + bulge);
    surface.push(gr + tr + bulge);
    line.push(ln);
    lower.push(low);
    clear.push(c);
    if (c < margin) {
      margin = c;
      worst = i;
    }
    if (ct < terrainMargin) terrainMargin = ct;
  }
  return { dist, d: ds, ground, surface, line, lower, clear, worst, margin, blockedByTerrain: terrainMargin < 0, visible: margin >= 0 };
}

export function viewshed(d: County, lon: number, lat: number, homes: { lon: number; lat: number; status: number }[], maxM = 7000) {
  const { kx, ky } = metersPerDeg(lat);
  const lambda = 299792458 / LOS.freq;
  const N = 120;
  const res = new Uint8Array(homes.length);
  const g0 = sampleElev(d, lon, lat) + LOS.towerH;
  let seen = 0, total = 0;
  for (let i = 0; i < homes.length; i++) {
    const h = homes[i];
    if (h.status === 0) continue;
    const dist = Math.hypot((h.lon - lon) * kx, (h.lat - lat) * ky);
    if (dist > maxM || dist < 40) continue;
    total++;
    const g1 = sampleElev(d, h.lon, h.lat) + LOS.homeH;
    let ok = true;
    for (let k = 1; k < N - 1; k++) {
      const f = k / (N - 1);
      const d1 = dist * f, d2 = dist - d1;
      if (d1 < LOS.endSkip || d2 < LOS.endSkip) continue;
      const x = lon + (h.lon - lon) * f, y = lat + (h.lat - lat) * f;
      const low = g0 + (g1 - g0) * f - LOS.fresnel * Math.sqrt((lambda * d1 * d2) / dist);
      if (sampleElev(d, x, y) + sampleCanopy(d, x, y) + (d1 * d2) / (2 * LOS.k * LOS.R) > low) { ok = false; break; }
    }
    res[i] = ok ? 1 : 2;
    if (ok) seen++;
  }
  return { res, seen, total };
}
