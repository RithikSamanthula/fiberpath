"use client";
import { useCallback, useEffect, useRef } from "react";
import type { County } from "@/lib/data";
import { metersPerDeg } from "@/lib/geo";

// The county as a solid-shaded 3D model of the real terrain. Flat facets, no gradients:
// each tile is one solid color picked from an elevation band, shaded by which way it faces.
// Green tiles are tall tree canopy. Routes, homes and towers sit on the ground.

const BANDS = ["#16263f", "#1a2e4b", "#1f3757", "#254163", "#2c4b70", "#34567c", "#3d6189", "#476c95", "#5278a1"];
const FOREST = ["#133a2f", "#17443a", "#1c4f42", "#215a4b"];

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type Props = { data: County; progress: number; spin?: boolean; compact?: boolean };

export default function Terrain3D({ data, progress, spin, compact }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const st = useRef({ yaw: 0.6, pitch: 0.95, zoom: 1, w: 0, h: 0, dpr: 1 });
  const grid = useRef<{ z: Float32Array; c: Float32Array; nx: number; ny: number; step: number; zmin: number; zmax: number } | null>(null);
  const prog = useRef(progress);
  prog.current = progress;
  const raf = useRef(0);

  // downsample once per county
  useEffect(() => {
    if (!data.hasGrids) return;
    const g = data.meta.grid;
    const step = Math.max(2, Math.round(g.nx / 230));
    const nx = Math.floor((g.nx - 1) / step), ny = Math.floor((g.ny - 1) / step);
    const z = new Float32Array((nx + 1) * (ny + 1)), c = new Float32Array((nx + 1) * (ny + 1));
    let zmin = Infinity, zmax = -Infinity;
    for (let r = 0; r <= ny; r++) for (let q = 0; q <= nx; q++) {
      const i = r * step * g.nx + q * step;
      const v = data.elev[i] / g.elevScale;
      z[r * (nx + 1) + q] = v;
      c[r * (nx + 1) + q] = data.canopy[i] / g.canopyScale;
      if (v < zmin) zmin = v;
      if (v > zmax) zmax = v;
    }
    grid.current = { z, c, nx, ny, step, zmin, zmax };
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const draw = useCallback(() => {
    const G = grid.current, canvas = cv.current;
    if (!G || !canvas) return;
    const { yaw, pitch, zoom, w, h, dpr } = st.current;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a1424";
    ctx.fillRect(0, 0, w, h);
    const g = data.meta.grid;
    const lat0 = g.n - (g.ny * g.dlat) / 2, lon0 = g.w + (g.nx * g.dlon) / 2;
    const { kx, ky } = metersPerDeg(lat0);
    const cs = Math.cos(yaw), sn = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const span = Math.max(g.nx * g.dlon * kx, g.ny * g.dlat * ky);
    const sc = (Math.min(w, h * 1.25) / span) * 1.05 * zoom;
    const ex = 2.2; // vertical exaggeration
    const zc = (G.zmin + G.zmax) / 2;
    // world (meters east, north, up) -> screen
    const P = (x: number, y: number, z: number): [number, number, number] => {
      const rx = x * cs + y * sn, ry = -x * sn + y * cs;
      const rz = (z - zc) * ex;
      return [w / 2 + rx * sc, h * 0.56 - (ry * sp + rz * cp) * sc, ry * cp - rz * sp];
    };
    const gx = (q: number) => (g.w + q * G.step * g.dlon - lon0) * kx;
    const gy = (r: number) => (g.n - r * G.step * g.dlat - lat0) * ky;
    const { nx, ny, z, c } = G;
    const zAt = (r: number, q: number) => z[r * (nx + 1) + q];
    const bandH = (G.zmax - G.zmin) / BANDS.length || 1;

    // painter's order: far tiles first
    const cols = Array.from({ length: nx }, (_, i) => i), rows = Array.from({ length: ny }, (_, i) => i);
    const farFirst = (v: number[], key: (i: number) => number) => v.sort((a, b) => key(b) - key(a));
    // depth increases away from the camera along (sin, cos) of the view direction after the yaw rotation
    farFirst(cols, (q) => (q - nx / 2) * (-sn) * 1);
    farFirst(rows, (r) => ((ny / 2 - r)) * cs);
    const colsOrd = sn >= 0 ? cols.slice().sort((a, b) => b - a) : cols.slice().sort((a, b) => a - b);
    const rowsOrd = cs >= 0 ? rows.slice().sort((a, b) => b - a) : rows.slice().sort((a, b) => a - b);
    // far-to-near for ry: ry = -x sn + y cs; larger ry is farther
    const lightX = -0.5, lightY = 0.7;
    for (const r of rowsOrd) {
      for (const q of colsOrd) {
        const z00 = zAt(r, q), z10 = zAt(r, q + 1), z01 = zAt(r + 1, q), z11 = zAt(r + 1, q + 1);
        const x0 = gx(q), x1 = gx(q + 1), y0 = gy(r), y1 = gy(r + 1);
        const a = P(x0, y0, z00), b = P(x1, y0, z10), cc = P(x1, y1, z11), d = P(x0, y1, z01);
        const zm = (z00 + z10 + z01 + z11) / 4;
        const dzdx = (z10 + z11 - z00 - z01) / (2 * (x1 - x0)), dzdy = (z00 + z10 - z01 - z11) / (2 * (y0 - y1));
        const lam = Math.max(0, (-dzdx * lightX - dzdy * lightY + 1) / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1));
        const level = lam > 0.82 ? 1.22 : lam > 0.66 ? 1.0 : lam > 0.5 ? 0.82 : 0.66;
        const tree = (c[r * (nx + 1) + q] + c[(r + 1) * (nx + 1) + q + 1]) / 2;
        const base = tree > 14 ? FOREST[Math.min(3, Math.floor((zm - G.zmin) / (bandH * 2.4)))] : BANDS[Math.min(BANDS.length - 1, Math.max(0, Math.floor((zm - G.zmin) / bandH)))];
        ctx.fillStyle = shade(base, level);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle; // hides hairline seams between tiles
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    // ground height at a lon/lat for draping overlays
    const ground = (lon: number, lat: number) => {
      const fq = ((lon - g.w) / g.dlon) / G.step, fr = ((g.n - lat) / g.dlat) / G.step;
      const q = Math.max(0, Math.min(nx - 1, Math.floor(fq))), r = Math.max(0, Math.min(ny - 1, Math.floor(fr)));
      return zAt(r, q);
    };
    const W = (lon: number, lat: number, lift = 4): [number, number, number] =>
      P((lon - lon0) * kx, (lat - lat0) * ky, ground(lon, lat) + lift);

    // routes drawn in
    const n = Math.floor(prog.current * data.plan.length);
    for (const cls of [2, 1]) {
      ctx.strokeStyle = cls === 1 ? "#4d8dff" : "#ffb81c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const e = data.plan[i];
        if (e[4] !== cls) continue;
        const a = W(e[0], e[1]), b = W(e[2], e[3]);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    // homes
    ctx.fillStyle = "#ff5a4a";
    const depth = n > 0 ? data.plan[Math.min(n, data.plan.length) - 1][5] : -1;
    ctx.beginPath();
    for (const hm of data.homes) {
      if (hm.status === 0) continue;
      if (hm.tech !== 0 && prog.current > 0 && hm.depth <= depth) continue;
      const p = W(hm.lon, hm.lat, 2);
      ctx.moveTo(p[0] + 1.6, p[1]); ctx.arc(p[0], p[1], 1.6, 0, 7);
    }
    ctx.fill();
    // towers as masts
    for (const t of data.towers) {
      if (!t.used) continue;
      const base = W(t.lon, t.lat, 0), top = W(t.lon, t.lat, 70);
      ctx.strokeStyle = "#38c47c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
      ctx.fillStyle = "#38c47c";
      ctx.fillRect(top[0] - 4, top[1] - 4, 8, 8);
    }
    const hub = W(data.meta.hub[0], data.meta.hub[1], 8);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(hub[0], hub[1] - 8); ctx.lineTo(hub[0] + 7, hub[1]); ctx.lineTo(hub[0], hub[1] + 8); ctx.lineTo(hub[0] - 7, hub[1]); ctx.closePath(); ctx.fill();
  }, [data]);

  const schedule = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(draw); }, [draw]);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      st.current.w = r.width; st.current.h = r.height; st.current.dpr = dpr;
      cv.current!.width = r.width * dpr; cv.current!.height = r.height * dpr;
      schedule();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule]);

  useEffect(schedule, [progress, schedule]);

  // slow turntable for decorative uses, until someone grabs it
  const grabbed = useRef(false);
  useEffect(() => {
    if (!spin) return;
    let id = 0;
    const loop = () => { if (!grabbed.current) { st.current.yaw += 0.0035; draw(); } id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [spin, draw]);

  useEffect(() => {
    const c = cv.current!;
    let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { grabbed.current = true; c.setPointerCapture(e.pointerId); down = { x: e.clientX, y: e.clientY }; };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      st.current.yaw += (e.clientX - down.x) * 0.006;
      st.current.pitch = Math.max(0.25, Math.min(1.45, st.current.pitch + (e.clientY - down.y) * 0.005));
      down = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const pu = () => { down = null; };
    const wh = (e: WheelEvent) => { if (spin) return; e.preventDefault(); st.current.zoom = Math.max(0.6, Math.min(4, st.current.zoom * Math.exp(-e.deltaY * 0.0015))); schedule(); };
    c.addEventListener("pointerdown", pd); c.addEventListener("pointermove", pm); c.addEventListener("pointerup", pu); c.addEventListener("pointercancel", pu);
    c.addEventListener("wheel", wh, { passive: false });
    return () => { c.removeEventListener("pointerdown", pd); c.removeEventListener("pointermove", pm); c.removeEventListener("pointerup", pu); c.removeEventListener("pointercancel", pu); c.removeEventListener("wheel", wh); };
  }, [schedule]);

  return (
    <div className="canvaswrap" ref={wrap}>
      <canvas ref={cv} className="map" role="img" aria-label={`3D terrain of ${data.meta.name}. Drag to rotate, scroll to zoom.`} />
      {!compact && <div className="noprint" style={{ position: "absolute", left: 12, top: 12, background: "#fff", padding: "6px 10px", fontSize: 13, borderRadius: 3 }}>Drag to rotate · scroll to zoom · green tiles are forest</div>}
    </div>
  );
}
