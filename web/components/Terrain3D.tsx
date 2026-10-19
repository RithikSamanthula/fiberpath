"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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

type Props = { data: County; progress: number; spin?: boolean; compact?: boolean; focus?: { lon: number; lat: number; key: number } | null; onPick?: (h: import("@/lib/data").Home | null) => void };

export default function Terrain3D({ data, progress, spin, compact, focus, onPick }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const st = useRef({ yaw: 0.6, pitch: 0.95, zoom: 1, w: 0, h: 0, dpr: 1 });
  const grid = useRef<{ z: Float32Array; c: Float32Array; nx: number; ny: number; step: number; zmin: number; zmax: number } | null>(null);
  const prog = useRef(progress);
  prog.current = progress;
  const [opts, setOpts] = useState({ houses: true, poles: true, wires: true, pulse: true, skyline: false });
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const hit = useRef<number[]>([]); // screen x, y and index of every home drawn last frame, for picking
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const cen = useRef<{ lon: number; lat: number } | null>(null); // what the view is centered on; null = the whole county
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
    const { nx, ny, z, c } = G;
    const zAt = (r: number, q: number) => z[r * (nx + 1) + q];
    // ground height at a lon/lat for draping overlays
    const ground = (lon: number, lat: number) => {
      const fq = ((lon - g.w) / g.dlon) / G.step, fr = ((g.n - lat) / g.dlat) / G.step;
      const q = Math.max(0, Math.min(nx - 1, Math.floor(fq))), r = Math.max(0, Math.min(ny - 1, Math.floor(fr)));
      return zAt(r, q);
    };
    // vertical origin: the whole county's middle height, or the ground under the home we flew to
    const zc = cen.current ? ground(cen.current.lon, cen.current.lat) : (G.zmin + G.zmax) / 2;
    // world (meters east, north, up) -> screen
    const offx = cen.current ? (cen.current.lon - lon0) * kx : 0, offy = cen.current ? (cen.current.lat - lat0) * ky : 0;
    const P = (x: number, y: number, z: number): [number, number, number] => {
      x -= offx; y -= offy;
      const rx = x * cs + y * sn, ry = -x * sn + y * cs;
      const rz = (z - zc) * ex;
      return [w / 2 + rx * sc, h * 0.56 - (ry * sp + rz * cp) * sc, ry * cp - rz * sp];
    };
    const gx = (q: number) => (g.w + q * G.step * g.dlon - lon0) * kx;
    const gy = (r: number) => (g.n - r * G.step * g.dlat - lat0) * ky;
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
    const o = optsRef.current;
    const nowT = performance.now() / 1000;
    // poles and wires along the routes that ride on poles (blue lines)
    if (o.poles || o.wires) {
      const seen = new Set<string>();
      const post: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const e = data.plan[i];
        if (e[4] !== 1) continue;
        const a = W(e[0], e[1], 0), tA = W(e[0], e[1], 9), tB = W(e[2], e[3], 9);
        if (o.wires) {
          const mid = W((e[0] + e[2]) / 2, (e[1] + e[3]) / 2, 7.6);
          ctx.strokeStyle = "#dfe8fb"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(tA[0], tA[1]); ctx.quadraticCurveTo(mid[0], mid[1], tB[0], tB[1]); ctx.stroke();
        }
        const k = `${e[0]},${e[1]}`;
        if (o.poles && !seen.has(k)) { seen.add(k); post.push([a[0], a[1], tA[1]]); }
      }
      if (o.poles) {
        ctx.strokeStyle = "#6aa0ff"; ctx.lineWidth = Math.max(1, sc * 0.9);
        ctx.beginPath();
        for (const q of post) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[2]); }
        ctx.stroke();
      }
    }
    // homes: a small block that lights up in the color of the technology that reaches it
    const depth = n > 0 ? data.plan[Math.min(n, data.plan.length) - 1][5] : -1;
    const big = sc * 7 > 2.6;
    const col = ["#7d90b3", "#4d8dff", "#ffb81c", "#38c47c"];
    hit.current = [];
    if (o.skyline) {
      // every connected home becomes a bar as tall as its cost: green is cheap, red is expensive
      for (const hm of data.homes) {
        if (hm.tech === 0) continue;
        const a = W(hm.lon, hm.lat, 0), b = W(hm.lon, hm.lat, Math.min(900, hm.cost / 16));
        if (a[0] < -20 || a[0] > w + 20 || a[1] < -300 || a[1] > h + 300) continue;
        ctx.strokeStyle = hm.cost < 4000 ? "#38c47c" : hm.cost < 9000 ? "#ffb81c" : "#ff5a4a";
        ctx.lineWidth = Math.max(1.4, sc * 4);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    for (const hm of data.homes) {
      if (o.skyline) break;
      if (hm.status === 0 && !big) continue;
      const up = hm.tech !== 0 && prog.current > 0 && hm.depth <= depth;
      const base = W(hm.lon, hm.lat, 0);
      if (base[0] < -20 || base[1] < -20 || base[0] > w + 20 || base[1] > h + 20) continue;
      const roof = W(hm.lon, hm.lat, o.houses ? 6 : 1);
      hit.current.push(roof[0], roof[1], hm.i);
      const color = hm.status === 0 ? "#51658a" : up ? col[hm.tech] : "#ff5a4a";
      if (big && o.houses) {
        const a = W(hm.lon - 0.00004, hm.lat - 0.00003, 0), b = W(hm.lon + 0.00004, hm.lat - 0.00003, 0);
        const a2 = W(hm.lon - 0.00004, hm.lat - 0.00003, 5), b2 = W(hm.lon + 0.00004, hm.lat - 0.00003, 5), c2 = W(hm.lon + 0.00004, hm.lat + 0.00003, 5), d2 = W(hm.lon - 0.00004, hm.lat + 0.00003, 5);
        ctx.fillStyle = "#1d2c47"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(a2[0], a2[1]); ctx.closePath(); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = color; ctx.fillRect(roof[0] - 1.4, roof[1] - 1.4, 2.8, 2.8);
      }
    }
    // data pulses riding the fibre outward from the hub
    if (o.pulse && prog.current >= 1) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      for (let i = 0; i < data.plan.length; i += 7) {
        const e = data.plan[i];
        const f = (nowT * 0.45 + (e[5] / (data.plan[data.plan.length - 1][5] || 1)) * 2.5 + i * 0.0131) % 1;
        const p = W(e[0] + (e[2] - e[0]) * f, e[1] + (e[3] - e[1]) * f, e[4] === 1 ? 9 : 1);
        ctx.moveTo(p[0] + 2, p[1]); ctx.arc(p[0], p[1], 2, 0, 7);
      }
      ctx.fill();
    }
    // a beacon on the home you flew to
    if (cen.current) {
      const a = W(cen.current.lon, cen.current.lat, 0), b = W(cen.current.lon, cen.current.lat, 40);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const pulse = 8 + ((nowT * 14) % 18);
      ctx.globalAlpha = 1 - (pulse - 8) / 18;
      ctx.beginPath(); ctx.arc(a[0], a[1], pulse, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(b[0], b[1], 4, 0, 7); ctx.fill();
    }
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
    if (!((opts.pulse && progress >= 1) || focus)) return;
    let id = 0;
    const loop = () => { if (!document.hidden) draw(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [opts.pulse, progress, draw, focus]);

  // fly to a chosen home
  useEffect(() => {
    if (!focus) { cen.current = null; st.current.zoom = 1; schedule(); return; }
    cen.current = { lon: focus.lon, lat: focus.lat };
    st.current.zoom = 80;
    schedule();
  }, [focus, schedule]);

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
    let moved = 0;
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const pd = (e: PointerEvent) => { moved = 0; grabbed.current = true; c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); down = { x: e.clientX, y: e.clientY }; pinch = 0; };
    const pm = (e: PointerEvent) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { // two fingers: pinch to zoom
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch && !spin) { st.current.zoom = Math.max(0.6, Math.min(60, st.current.zoom * (d / pinch))); schedule(); }
        pinch = d; moved = 99; down = { x: e.clientX, y: e.clientY };
        return;
      }
      if (!down) return;
      moved += Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      st.current.yaw += (e.clientX - down.x) * 0.006;
      st.current.pitch = Math.max(0.25, Math.min(1.45, st.current.pitch + (e.clientY - down.y) * 0.005));
      down = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const pu = (e: PointerEvent) => {
      ptrs.delete(e.pointerId); pinch = 0;
      down = null;
      if (moved < 6 && pickRef.current) {
        const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        let best = -1, bd = 14;
        const a = hit.current;
        for (let i = 0; i < a.length; i += 3) { const d = Math.hypot(a[i] - x, a[i + 1] - y); if (d < bd) { bd = d; best = a[i + 2]; } }
        pickRef.current(best >= 0 ? data.homes[best] : null);
      }
    };
    const wh = (e: WheelEvent) => { if (spin) return; e.preventDefault(); st.current.zoom = Math.max(0.6, Math.min(60, st.current.zoom * Math.exp(-e.deltaY * 0.0015))); schedule(); };
    c.addEventListener("pointerdown", pd); c.addEventListener("pointermove", pm); c.addEventListener("pointerup", pu); c.addEventListener("pointercancel", pu);
    c.addEventListener("wheel", wh, { passive: false });
    return () => { c.removeEventListener("pointerdown", pd); c.removeEventListener("pointermove", pm); c.removeEventListener("pointerup", pu); c.removeEventListener("pointercancel", pu); c.removeEventListener("wheel", wh); };
  }, [schedule, data, spin]);

  return (
    <div className="canvaswrap" ref={wrap}>
      <canvas ref={cv} className="map" role="img" aria-label={`3D terrain of ${data.meta.name}. Drag to rotate, scroll to zoom.`} />
      {!compact && (
        <div className="noprint" style={{ position: "absolute", left: 12, top: 12, display: "grid", gap: 6 }}>
          <div style={{ background: "#fff", padding: "6px 10px", fontSize: 13, borderRadius: 3 }}>Drag to rotate · scroll to zoom · select a home to fly to it</div>
          <div className="toggles">
            {(["houses", "poles", "wires", "pulse", "skyline"] as const).map((k) => (
              <button key={k} className="btn sm" aria-pressed={opts[k]} style={{ background: opts[k] ? "#0f1b2d" : "#fff", color: opts[k] ? "#fff" : "#1b5fd1", borderColor: opts[k] ? "#0f1b2d" : "#1b5fd1" }} onClick={() => setOpts((v) => ({ ...v, [k]: !v[k] }))}>{k === "pulse" ? "Data pulses" : k === "skyline" ? "Cost skyline" : k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
