"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Contours } from "@/lib/contours";
import type { County, Home } from "@/lib/data";

export type Layers = {
  roads: boolean;
  plan: boolean;
  homes: boolean;
  towers: boolean;
  poles: boolean;
  wireless: boolean;
};

type Props = {
  data: County;
  layers: Layers;
  progress?: number; // 0..1, how much of the plan has drawn in
  selected?: Home | null;
  onPick?: (h: Home | null) => void;
  focus?: { lon: number; lat: number; zoom?: number; key: number } | null;
  link?: { a: [number, number]; b: [number, number] } | null;
  hexes?: { lon: number; lat: number; count: number }[];
  contours?: Contours | null;
  reach?: Uint8Array | null; // per home: 1 sees the tower, 2 blocked
  ghost?: { lon: number; lat: number } | null;
  onMapClick?: ((lon: number, lat: number) => void) | null;
  still?: boolean; // no pan or zoom, for decorative maps
  pulse?: boolean; // animate data pulses flowing out from the hub along every route
};

type View = { lon: number; lat: number; s: number };

export default function MapView({ data, layers, progress = 1, selected, onPick, focus, link, hexes, contours, reach, ghost, onMapClick, still, pulse }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const raf = useRef(0);
  const props = useRef({ data, layers, progress, selected, link, hexes, contours, reach, ghost, pulse });
  props.current = { data, layers, progress, selected, link, hexes, contours, reach, ghost, pulse };
  const [, setTick] = useState(0);

  const cosφ = () => Math.cos(((view.current?.lat ?? 35) * Math.PI) / 180);
  const toX = (lon: number) => (lon - view.current!.lon) * cosφ() * view.current!.s + size.current.w / 2;
  const toY = (lat: number) => (view.current!.lat - lat) * view.current!.s + size.current.h / 2;

  const draw = useCallback(() => {
    const cv = canvas.current;
    const v = view.current;
    if (!cv || !v) return;
    const { w, h, dpr } = size.current;
    const ctx = cv.getContext("2d")!;
    const { data, layers, progress, selected, link, hexes, contours, reach, ghost, pulse } = props.current;
    const BG = "#0f1b2d", ROAD = "#31435f", LINE = "#7d90b3", MUTE = "#51658a";
    const BLUE = "#4d8dff", AMBER = "#ffb81c", GREEN = "#38c47c", RED = "#ff5a4a", WHITE = "#ffffff";
    const k = cosφ();
    const X = (lon: number) => (lon - v.lon) * k * v.s + w / 2;
    const Y = (lat: number) => (v.lat - lat) * v.s + h / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = LINE;
    ctx.fillStyle = LINE;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // county line
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    data.meta.boundary.forEach(([lo, la], i) => (i ? ctx.lineTo(X(lo), Y(la)) : ctx.moveTo(X(lo), Y(la))));
    ctx.closePath();
    ctx.stroke();

    if (contours) {
      for (const [seg, color, lw] of [[contours.minor, "#16273f", 0.8], [contours.major, "#22385a", 1.2]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i < seg.length; i += 4) {
          ctx.moveTo(X(seg[i]), Y(seg[i + 1]));
          ctx.lineTo(X(seg[i + 2]), Y(seg[i + 3]));
        }
        ctx.stroke();
      }
      ctx.strokeStyle = LINE;
    }

    if (layers.roads) {
      ctx.strokeStyle = ROAD;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of data.roads) {
        for (let i = 0; i < r.length; i++) (i ? ctx.lineTo(X(r[i][0]), Y(r[i][1])) : ctx.moveTo(X(r[i][0]), Y(r[i][1])));
      }
      ctx.stroke();
      ctx.strokeStyle = LINE;
    }

    // demand cells
    if (hexes && hexes.length) {
      for (const c of hexes) {
        const r = Math.min(26, 6 + Math.sqrt(c.count) * 3);
        ctx.beginPath();
        ctx.arc(X(c.lon), Y(c.lat), r, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = AMBER;
        ctx.stroke();
        ctx.strokeStyle = LINE;
      }
    }

    const nPlan = Math.floor(progress * data.plan.length);
    const depthNow = nPlan > 0 ? data.plan[Math.min(nPlan, data.plan.length) - 1][5] : -1;

    if (layers.wireless && progress >= 1) {
      // every link when zoomed in, otherwise only the selected home's tower
      const all = v.s > 60000;
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      for (const hm of data.homes) {
        if (hm.tech !== 3) continue;
        if (!all && !(selected && selected.tech === 3 && selected.tower === hm.tower)) continue;
        const t = data.towers[hm.tower];
        ctx.moveTo(X(t.lon), Y(t.lat));
        ctx.lineTo(X(hm.lon), Y(hm.lat));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = LINE;
    }

    if (layers.homes) {
      const r = Math.max(1.4, Math.min(5, v.s / 22000));
      // served and not part of the plan
      ctx.fillStyle = MUTE;
      ctx.beginPath();
      for (const hm of data.homes) {
        if (hm.status !== 0) continue;
        const x = X(hm.lon), y = Y(hm.lat);
        if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
        ctx.moveTo(x + r * 0.7, y);
        ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      }
      ctx.fill();
      // homes still without service (filled)
      ctx.fillStyle = RED;
      ctx.beginPath();
      for (const hm of data.homes) {
        if (hm.status === 0) continue;
        if (hm.tech !== 0 && layers.plan && hm.depth <= depthNow) continue;
        const x = X(hm.lon), y = Y(hm.lat);
        if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      // connected by the plan (hollow)
      if (layers.plan) {
        ctx.fillStyle = BG;
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (const hm of data.homes) {
          if (hm.tech === 0 || hm.depth > depthNow) continue;
          const x = X(hm.lon), y = Y(hm.lat);
          if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
      }
    }

    if (layers.plan) {
      // white casing under each route keeps it legible over dense homes
      for (const pass of [0, 1]) {
        for (const cls of [2, 1]) {
          ctx.strokeStyle = pass === 0 ? BG : cls === 1 ? BLUE : AMBER;
          ctx.lineWidth = pass === 0 ? 6 : 2.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          for (let i = 0; i < nPlan; i++) {
            const e = data.plan[i];
            if (e[4] !== cls) continue;
            ctx.moveTo(X(e[0]), Y(e[1]));
            ctx.lineTo(X(e[2]), Y(e[3]));
          }
          ctx.stroke();
        }
      }
      ctx.strokeStyle = LINE;
      if (pulse && progress >= 1) {
        // each pulse rides one route segment outward from the hub; speed follows how far the segment is from the hub
        const t = performance.now() / 2200;
        const maxD = data.plan[data.plan.length - 1]?.[5] || 1;
        ctx.fillStyle = WHITE;
        ctx.beginPath();
        for (let i = 0; i < data.plan.length; i += 6) {
          const e = data.plan[i];
          const f = (t + (e[5] / maxD) * 3 + i * 0.0137) % 1;
          const x = X(e[0] + (e[2] - e[0]) * f), y = Y(e[1] + (e[3] - e[1]) * f);
          if (x < 0 || y < 0 || x > w || y > h) continue;
          ctx.moveTo(x + 2.2, y);
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    if (layers.poles) {
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const p of data.poles) {
        const x = X(p[0]), y = Y(p[1]);
        if (x < -6 || y < -6 || x > w + 6 || y > h + 6) continue;
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y);
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x, y + 3);
      }
      ctx.stroke();
      ctx.strokeStyle = LINE;
    }

    if (reach) {
      const r = Math.max(2.2, Math.min(6, v.s / 18000));
      for (const [val, color] of [[2, "#5a2f3f"], [1, GREEN]] as const) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < data.homes.length; i++) {
          if (reach[i] !== val) continue;
          const hm = data.homes[i];
          const x = X(hm.lon), y = Y(hm.lat);
          if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    if (ghost) {
      const x = X(ghost.lon), y = Y(ghost.lat);
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(x, y, (7000 / 110574) * v.s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = WHITE;
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = GREEN;
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.strokeStyle = LINE;
    }

    if (layers.towers) {
      for (const t of data.towers) {
        if (!t.used) continue;
        const x = X(t.lon), y = Y(t.lat);
        ctx.fillStyle = GREEN;
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = BG;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }

    // hub
    {
      const x = X(data.meta.hub[0]), y = Y(data.meta.hub[1]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 8, y);
      ctx.closePath();
      ctx.fillStyle = WHITE;
      ctx.strokeStyle = WHITE;
      ctx.fill();
      ctx.stroke();
    }

    if (link) {
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(X(link.a[0]), Y(link.a[1]));
      ctx.lineTo(X(link.b[0]), Y(link.b[1]));
      ctx.stroke();
    }

    if (selected) {
      const x = X(selected.lon), y = Y(selected.lat);
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 18, y);
      ctx.lineTo(x - 11, y);
      ctx.moveTo(x + 11, y);
      ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y - 11);
      ctx.moveTo(x, y + 11);
      ctx.lineTo(x, y + 18);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    if (!pulse) return;
    let id = 0;
    const loop = () => { draw(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [pulse, draw]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
  }, [draw]);

  const fit = useCallback(() => {
    const { w, h } = size.current;
    if (!w || !h) return;
    const [w0, s0, e0, n0] = props.current.data.meta.bbox;
    const lat = (s0 + n0) / 2;
    const k = Math.cos((lat * Math.PI) / 180);
    const sx = (w * 0.92) / ((e0 - w0) * k);
    const sy = (h * 0.92) / (n0 - s0);
    view.current = { lon: (w0 + e0) / 2, lat, s: Math.min(sx, sy) };
  }, []);

  // size + first fit
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const first = !view.current;
      size.current = { w: r.width, h: r.height, dpr };
      const cv = canvas.current!;
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      if (first) {
        fit();
        const f = focusRef.current;
        if (f) view.current = { lon: f.lon, lat: f.lat, s: f.zoom ?? view.current!.s };
      }
      schedule();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, schedule]);

  useEffect(schedule, [data, layers, progress, selected, link, hexes, contours, reach, ghost, schedule]);

  useEffect(() => {
    if (!focus || !view.current) return;
    view.current = { lon: focus.lon, lat: focus.lat, s: focus.zoom ?? Math.max(view.current.s, 90000) };
    schedule();
  }, [focus, schedule]);

  // pointer gestures
  useEffect(() => {
    if (still) return;
    const cv = canvas.current!;
    const pts = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0 };
    let moved = 0;
    let lastDist = 0;

    const zoomAt = (px: number, py: number, factor: number) => {
      const v = view.current!;
      const k = Math.cos((v.lat * Math.PI) / 180);
      const lon = (px - size.current.w / 2) / (k * v.s) + v.lon;
      const lat = v.lat - (py - size.current.h / 2) / v.s;
      const s = Math.min(Math.max(v.s * factor, 2000), 600000);
      const f = s / v.s;
      view.current = { s, lon: lon - (lon - v.lon) / f, lat: lat - (lat - v.lat) / f };
      schedule();
    };

    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      start = { x: e.offsetX, y: e.offsetY };
      moved = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      cv.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
      p.x = e.offsetX;
      p.y = e.offsetY;
      moved += Math.abs(dx) + Math.abs(dy);
      const v = view.current!;
      if (pts.size === 1) {
        const k = Math.cos((v.lat * Math.PI) / 180);
        view.current = { s: v.s, lon: v.lon - dx / (k * v.s), lat: v.lat + dy / v.s };
        schedule();
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / lastDist);
        lastDist = d;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      cv.style.cursor = "grab";
      lastDist = 0;
      if (moved < 6 && pts.size === 0 && (props.current.layers.homes || mapClickRef.current)) {
        const v = view.current!;
        const k = Math.cos((v.lat * Math.PI) / 180);
        let best: Home | null = null;
        let bd = 18;
        for (const hm of props.current.data.homes) {
          const x = (hm.lon - v.lon) * k * v.s + size.current.w / 2;
          const y = (v.lat - hm.lat) * v.s + size.current.h / 2;
          const d = Math.hypot(x - start.x, y - start.y);
          if (d < bd) {
            bd = d;
            best = hm;
          }
        }
        if (mapClickRef.current) {
          const lon = (start.x - size.current.w / 2) / (k * v.s) + v.lon;
          const lat = v.lat - (start.y - size.current.h / 2) / v.s;
          mapClickRef.current(lon, lat);
        } else onPickRef.current?.(best);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("wheel", wheel);
    };
  }, [schedule]);

  const focusRef = useRef(focus);
  focusRef.current = focus;
  const mapClickRef = useRef(onMapClick);
  mapClickRef.current = onMapClick;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const zoom = (f: number) => {
    const v = view.current!;
    view.current = { ...v, s: Math.min(Math.max(v.s * f, 2000), 600000) };
    schedule();
    setTick((t) => t + 1);
  };

  return (
    <div className="canvaswrap" ref={wrap}>
      <canvas ref={canvas} className="map" role="img" aria-label={`Map of ${data.meta.name}, ${data.meta.state}`} />
      {!still && <div style={{ position: "absolute", right: 12, top: 12, display: "grid", gap: 0 }} className="noprint">
        <button className="btn line" style={{ minWidth: 44 }} onClick={() => zoom(1.6)} aria-label="Zoom in">+</button>
        <button className="btn line" style={{ minWidth: 44, borderTop: 0 }} onClick={() => zoom(1 / 1.6)} aria-label="Zoom out">−</button>
        <button className="btn line" style={{ minWidth: 44, borderTop: 0, fontSize: 13 }} onClick={() => { fit(); schedule(); }} aria-label="Reset view">All</button>
      </div>}
    </div>
  );
}
