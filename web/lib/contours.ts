import type { County } from "./data";

export type Contours = { minor: Float32Array; major: Float32Array };

// Marching squares over the elevation grid. Returns line segments as [lon1, lat1, lon2, lat2, ...].
export function contours(d: County, stride = 3, step = 60, majorEvery = 5): Contours {
  const g = d.meta.grid;
  const nx = Math.floor((g.nx - 1) / stride), ny = Math.floor((g.ny - 1) / stride);
  const z = new Float32Array((nx + 1) * (ny + 1));
  for (let r = 0; r <= ny; r++) for (let c = 0; c <= nx; c++) z[r * (nx + 1) + c] = d.elev[r * stride * g.nx + c * stride] / g.elevScale;
  const lon = (c: number) => g.w + c * stride * g.dlon;
  const lat = (r: number) => g.n - r * stride * g.dlat;
  const minor: number[] = [], major: number[] = [];
  let lo = Infinity, hi = -Infinity;
  for (const v of z) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let lv = Math.ceil(lo / step) * step; lv <= hi; lv += step) {
    const out = Math.round(lv / step) % majorEvery === 0 ? major : minor;
    const t = (a: number, b: number) => (lv - a) / (b - a);
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const a = z[r * (nx + 1) + c], b = z[r * (nx + 1) + c + 1], cc = z[(r + 1) * (nx + 1) + c + 1], dd = z[(r + 1) * (nx + 1) + c];
        const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (cc > lv ? 2 : 0) | (dd > lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        // edge crossings: top, right, bottom, left
        const T = [lon(c) + t(a, b) * stride * g.dlon, lat(r)];
        const R = [lon(c + 1), lat(r) - t(b, cc) * stride * g.dlat];
        const B = [lon(c) + t(dd, cc) * stride * g.dlon, lat(r + 1)];
        const L = [lon(c), lat(r) - t(a, dd) * stride * g.dlat];
        const seg = (p: number[], q: number[]) => out.push(p[0], p[1], q[0], q[1]);
        switch (idx) {
          case 1: case 14: seg(L, B); break;
          case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(L, R); break;
          case 4: case 11: seg(T, R); break;
          case 5: seg(T, L); seg(B, R); break;
          case 10: seg(T, R); seg(L, B); break;
          case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(T, L); break;
        }
      }
    }
  }
  return { minor: new Float32Array(minor), major: new Float32Array(major) };
}
