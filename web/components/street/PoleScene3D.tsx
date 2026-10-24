"use client";
import { useCallback, useEffect, useRef } from "react";
import type { Frame, Obs, Pole } from "@/lib/poleLocate";

type Props = {
  frames: Frame[];
  obs: Obs[];
  poles: Pole[];
  ref?: [number, number][];
  current?: number;
  camH?: number;
};

// The street rebuilt in 3D from the photos: each camera position, a ray for every pole the detector saw,
// and the poles those rays agree on, standing where the geometry says they are.
export default function PoleScene3D({ frames, obs, poles, ref = [], current = -1, camH = 1.6 }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const st = useRef({ yaw: 0, pitch: 0.62, zoom: 1, w: 0, h: 0, dpr: 1 }); // yaw is the viewer's own turn, added to "look along the road"
  const props = useRef({ frames, obs, poles, ref, current, camH });
  props.current = { frames, obs, poles, ref, current, camH };
  const raf = useRef(0);

  const draw = useCallback(() => {
    const c = cv.current;
    if (!c) return;
    const { frames, obs, poles, ref, current, camH } = props.current;
    const { pitch, zoom, w, h, dpr } = st.current;
    // the view follows the photo you are on, looking down the road
    const here = frames[Math.max(0, Math.min(frames.length - 1, current))] ?? frames[0];
    const yaw = -((here?.heading ?? 0) * Math.PI) / 180 + st.current.yaw;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a1424";
    ctx.fillRect(0, 0, w, h);
    if (!frames.length) return;
    const lat0 = here.lat, lon0 = here.lon;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
    const E = (lon: number) => (lon - lon0) * kx, N = (lat: number) => (lat - lat0) * ky;
    const r = 70; // metres of street shown around the current photo
    const sc = (Math.min(w, h) / (2 * r)) * 1.7 * zoom;
    const cs = Math.cos(yaw), sn = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const P = (x: number, y: number, z: number): [number, number] => {
      const rx = x * cs + y * sn, ry = -x * sn + y * cs;
      return [w / 2 + rx * sc, h * 0.72 - (ry * sp + z * cp) * sc];
    };
    // ground grid, one line per 10 m
    ctx.strokeStyle = "#17283f"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = -Math.ceil(r / 10) * 10; g <= r + 10; g += 10) {
      let a = P(g, -r, 0), b = P(g, r, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      a = P(-r, g, 0); b = P(r, g, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    // the path the camera took
    ctx.strokeStyle = "#5b6f90"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    frames.forEach((f, i) => { const p = P(E(f.lon), N(f.lat), 0); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
    ctx.strokeStyle = "#0a1424"; ctx.lineWidth = 2;
    ctx.beginPath();
    frames.forEach((f, i) => { const p = P(E(f.lon), N(f.lat), 0); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
    // rays: camera -> where the detector put the pole base
    ctx.lineWidth = 1;
    for (const o of obs) {
      const f = frames[o.frame];
      if (!f) continue;
      const a = P(E(f.lon), N(f.lat), camH), b = P(E(o.lon), N(o.lat), 0);
      ctx.strokeStyle = o.frame === current ? "rgba(255,184,28,0.95)" : "rgba(77,141,255,0.16)";
      ctx.lineWidth = o.frame === current ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // cameras
    frames.forEach((f, i) => {
      const p = P(E(f.lon), N(f.lat), camH);
      const hd = (f.heading * Math.PI) / 180;
      const tip = P(E(f.lon) + Math.sin(hd) * 5, N(f.lat) + Math.cos(hd) * 5, camH);
      ctx.strokeStyle = i === current ? "#ffb81c" : "#8fa3c4"; ctx.lineWidth = i === current ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
      ctx.fillStyle = i === current ? "#ffb81c" : "#c6d1e4";
      ctx.beginPath(); ctx.arc(p[0], p[1], i === current ? 5 : 3, 0, 7); ctx.fill();
    });
    // reference poles other sources mapped (hollow amber)
    for (const q of ref) {
      const x = E(q[0]), y = N(q[1]);
      if (Math.hypot(x, y) > r + 20) continue;
      const a = P(x, y, 0), b = P(x, y, 9);
      ctx.strokeStyle = "#ffb81c"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(b[0], b[1], 4, 0, 7); ctx.stroke();
    }
    // wires between poles that are close together, the way a line would hang
    const sorted = [...poles].filter((p) => p.views >= 1);
    ctx.strokeStyle = "#e6ecf7"; ctx.lineWidth = 1.2;
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      const d = Math.hypot(E(a.lon) - E(b.lon), N(a.lat) - N(b.lat));
      if (d > 70) continue;
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.1) {
        const x = E(a.lon) + (E(b.lon) - E(a.lon)) * t, y = N(a.lat) + (N(b.lat) - N(a.lat)) * t;
        const z = 8.2 - Math.sin(t * Math.PI) * Math.min(1.6, d / 25);
        const p = P(x, y, z); t ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    // the located poles
    for (const q of poles) {
      const x = E(q.lon), y = N(q.lat);
      const a = P(x, y, 0), b = P(x, y, 9);
      const good = q.views >= 3;
      ctx.strokeStyle = good ? "#4d8dff" : "#7aa7ff"; ctx.lineWidth = good ? 4 : 2.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const arm = [P(x - 1.2, y, 8.3), P(x + 1.2, y, 8.3)];
      ctx.beginPath(); ctx.moveTo(arm[0][0], arm[0][1]); ctx.lineTo(arm[1][0], arm[1][1]); ctx.stroke();
      // uncertainty on the ground
      ctx.strokeStyle = "rgba(77,141,255,0.55)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(a[0], a[1], Math.max(3, q.spread * sc), Math.max(2, q.spread * sc * sp), 0, 0, 7); ctx.stroke();
      if (good) { ctx.fillStyle = "#fff"; ctx.font = "600 11px -apple-system, Helvetica, Arial, sans-serif"; ctx.fillText(`${q.views} views`, b[0] + 6, b[1] + 3); }
    }
  }, []);

  const schedule = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(draw); }, [draw]);
  useEffect(schedule, [frames, obs, poles, ref, current, camH, schedule]);

  useEffect(() => {
    const el = wrap.current!, c = cv.current!;
    const ro = new ResizeObserver(() => {
      const b = el.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      st.current.w = b.width; st.current.h = b.height; st.current.dpr = dpr;
      c.width = b.width * dpr; c.height = b.height * dpr;
      schedule();
    });
    ro.observe(el);
    let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { c.setPointerCapture(e.pointerId); down = { x: e.clientX, y: e.clientY }; };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      st.current.yaw += (e.clientX - down.x) * 0.006;
      st.current.pitch = Math.max(0.2, Math.min(1.5, st.current.pitch + (e.clientY - down.y) * 0.005));
      down = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const pu = () => { down = null; };
    const wh = (e: WheelEvent) => { e.preventDefault(); st.current.zoom = Math.max(0.5, Math.min(5, st.current.zoom * Math.exp(-e.deltaY * 0.0015))); schedule(); };
    c.addEventListener("pointerdown", pd); c.addEventListener("pointermove", pm); c.addEventListener("pointerup", pu); c.addEventListener("pointercancel", pu);
    c.addEventListener("wheel", wh, { passive: false });
    return () => { ro.disconnect(); c.removeEventListener("pointerdown", pd); c.removeEventListener("pointermove", pm); c.removeEventListener("pointerup", pu); c.removeEventListener("pointercancel", pu); c.removeEventListener("wheel", wh); };
  }, [schedule]);

  return (
    <div ref={wrap} style={{ position: "relative", width: "100%", height: "100%", minHeight: 320, background: "#0a1424" }}>
      <canvas ref={cv} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "grab" }} role="img" aria-label="3D reconstruction of the street with located utility poles" />
      <div style={{ position: "absolute", left: 10, bottom: 10, background: "var(--card)", padding: "6px 10px", fontSize: 12, borderRadius: 0, lineHeight: 1.5 }}>
        <span style={{ color: "var(--blue)", fontWeight: 800 }}>█</span> located pole &nbsp; <span style={{ color: "#c98a00", fontWeight: 800 }}>┆</span> already mapped &nbsp; <span style={{ color: "#6b7f9f", fontWeight: 800 }}>●</span> camera &nbsp; thin lines: what each photo saw
      </div>
    </div>
  );
}
