
export type Frame = {
  id: string; lon: number; lat: number; heading: number; focal: number; w: number; h: number; url: string;
  capturedAt?: string; type?: string;
  rot?: [number, number, number];
  k?: [number, number];
};
export type Det = { x: number; y: number; w: number; h: number; score: number; cls?: number };
export type Obs = { frame: number; lon: number; lat: number; range: number; score: number; poleHeight: number };
export type Pole = { lon: number; lat: number; views: number; spread: number; frames: number[]; score: number; firstFrame: number };

const kxy = (lat: number) => ({ kx: 111320 * Math.cos((lat * Math.PI) / 180), ky: 110574 });

function camToWorld(r: [number, number, number]) {
  const th = Math.hypot(r[0], r[1], r[2]);
  if (th < 1e-9) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [x, y, z] = [r[0] / th, r[1] / th, r[2] / th];
  const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  const R = [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
  return [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
}

function ray(f: Frame, u: number, v: number): [number, number, number] {
  const fpx = f.focal * Math.max(f.w, f.h);
  let x = (u * f.w - f.w / 2) / fpx, y = (v * f.h - f.h / 2) / fpx;
  if (f.k) { const r2 = x * x + y * y; const d = 1 + f.k[0] * r2 + f.k[1] * r2 * r2; x /= d; y /= d; }
  if (f.rot) {
    const M = camToWorld(f.rot);
    return [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2], M[2][0] * x + M[2][1] * y + M[2][2]];
  }
  const h = (f.heading * Math.PI) / 180;
  return [Math.sin(h) * 1 + Math.cos(h) * x, Math.cos(h) * 1 - Math.sin(h) * x, -y];
}

type Ray = { f: number; x: number; y: number; dx: number; dy: number; score: number; elev: number; h: number };

export function locate(frames: Frame[], dets: (Det[] | undefined)[], camH = 1.6): { obs: Obs[]; poles: Pole[] } {
  if (!frames.length) return { obs: [], poles: [] };
  const lat0 = frames[0].lat, lon0 = frames[0].lon;
  const { kx, ky } = kxy(lat0);
  const rays: Ray[] = [];
  frames.forEach((f, fi) => {
    for (const d of dets[fi] ?? []) {
      if ((d.cls ?? 0) !== 0 || d.h < 0.05) continue;
      const r = ray(f, d.x + d.w / 2, d.y + d.h / 2);
      const hz = Math.hypot(r[0], r[1]);
      if (hz < 1e-6) continue;
      const top = ray(f, d.x + d.w / 2, d.y);
      rays.push({ f: fi, x: (f.lon - lon0) * kx, y: (f.lat - lat0) * ky, dx: r[0] / hz, dy: r[1] / hz, score: d.score, elev: top[2] / Math.max(1e-6, Math.hypot(top[0], top[1])), h: d.h });
    }
  });
  const cands: [number, number][] = [];
  for (let i = 0; i < rays.length; i++) for (let j = i + 1; j < rays.length; j++) {
    const a = rays[i], b = rays[j];
    if (a.f === b.f || Math.hypot(a.x - b.x, a.y - b.y) < 8) continue;
    const det = -a.dx * b.dy + b.dx * a.dy;
    if (Math.abs(det) < Math.sin((5 * Math.PI) / 180)) continue;
    const rx = b.x - a.x, ry = b.y - a.y;
    const s = (-rx * b.dy + b.dx * ry) / det, t = (a.dx * ry - a.dy * rx) / det;
    if (s > 3 && s < 90 && t > 3 && t < 90) cands.push([a.x + s * a.dx, a.y + s * a.dy]);
  }
  const support = (p: [number, number], tol = 2.0) => {
    const items: Ray[] = [];
    for (const r of rays) {
      const vx = p[0] - r.x, vy = p[1] - r.y;
      const s = vx * r.dx + vy * r.dy;
      if (s > 3 && s < 90 && Math.abs(vx * r.dy - vy * r.dx) < tol) items.push(r);
    }
    return items;
  };
  const scored = cands.map((p) => ({ p, items: support(p) })).map((c) => ({ ...c, n: new Set(c.items.map((r) => r.f)).size })).sort((a, b) => b.n - a.n);
  const found: { p: [number, number]; items: Ray[]; n: number }[] = [];
  for (const c of scored) {
    if (c.n < 2) break;
    if (found.some((q) => Math.hypot(q.p[0] - c.p[0], q.p[1] - c.p[1]) < 6)) continue;
    found.push(c);
  }
  const obs: Obs[] = [];
  const poles: Pole[] = found.map((c) => {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const r of c.items) { const m11 = 1 - r.dx * r.dx, m12 = -r.dx * r.dy, m22 = 1 - r.dy * r.dy; a11 += m11; a12 += m12; a22 += m22; b1 += m11 * r.x + m12 * r.y; b2 += m12 * r.x + m22 * r.y; }
    const dt = a11 * a22 - a12 * a12;
    const p: [number, number] = Math.abs(dt) > 1e-9 ? [(a22 * b1 - a12 * b2) / dt, (a11 * b2 - a12 * b1) / dt] : c.p;
    const sp = Math.sqrt(c.items.reduce((s, r) => s + (((p[0] - r.x) * r.dy - (p[1] - r.y) * r.dx) ** 2), 0) / c.items.length);
    const fr = [...new Set(c.items.map((r) => r.f))].sort((x, y) => x - y);
    for (const r of c.items) obs.push({ frame: r.f, lon: p[0] / kx + lon0, lat: p[1] / ky + lat0, range: Math.hypot(p[0] - r.x, p[1] - r.y), score: r.score, poleHeight: camH + Math.hypot(p[0] - r.x, p[1] - r.y) * r.elev });
    return { lon: p[0] / kx + lon0, lat: p[1] / ky + lat0, views: fr.length, spread: sp, frames: fr, score: c.items.reduce((s, r) => s + r.score, 0) / c.items.length, firstFrame: fr[0] };
  });
  return { obs, poles: poles.sort((a, b) => a.firstFrame - b.firstFrame) };
}

export function compare(poles: Pole[], ref: [number, number][]) {
  if (!poles.length || !ref.length) return null;
  const lat0 = poles[0].lat;
  const { kx, ky } = kxy(lat0);
  const errs: number[] = [];
  for (const p of poles) {
    let best = Infinity;
    for (const r of ref) best = Math.min(best, Math.hypot((p.lon - r[0]) * kx, (p.lat - r[1]) * ky));
    if (best <= 15) errs.push(best);
  }
  errs.sort((a, b) => a - b);
  return { matched: errs.length, of: poles.length, median: errs.length ? errs[Math.floor(errs.length / 2)] : null };
}
