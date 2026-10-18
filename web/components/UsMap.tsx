"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DATA_BASE } from "@/lib/data";
import { useIndex } from "@/lib/useIndex";

type C = [string, string, string, number, number];

// Albers equal-area conic, the standard projection for maps of the lower 48.
function albers(lon: number, lat: number, lat1 = 29.5, lat2 = 45.5, lat0 = 37.5, lon0 = -96) {
  const r = Math.PI / 180;
  const n = (Math.sin(lat1 * r) + Math.sin(lat2 * r)) / 2;
  const C0 = Math.cos(lat1 * r) ** 2 + 2 * n * Math.sin(lat1 * r);
  const rho0 = Math.sqrt(C0 - 2 * n * Math.sin(lat0 * r)) / n;
  const rho = Math.sqrt(C0 - 2 * n * Math.sin(lat * r)) / n;
  const th = n * (lon - lon0) * r;
  return [rho * Math.sin(th), rho0 - rho * Math.cos(th)] as const;
}

const INSET: Record<string, [number, number, number, number, number, number]> = {
  // state: lat1, lat2, lat0, lon0, anchor x, anchor width (as fractions of the lower-48 box)
  "02": [55, 65, 50, -154, 0.0, 0.26],
  "15": [8, 18, 3, -157, 0.3, 0.17],
  "72": [17, 19, 18, -66, 0.82, 0.1],
};

// Lower 48 in Albers; Alaska, Hawaii and Puerto Rico are redrawn as small insets below it.
function projectAll(cs: C[]): [number, number][] {
  const out: [number, number][] = new Array(cs.length);
  const main: number[] = [];
  cs.forEach((c, i) => { if (!INSET[c[2]]) { const p = albers(c[4], c[3]); out[i] = [p[0], p[1]]; main.push(i); } });
  const xs = main.map((i) => out[i][0]), ys = main.map((i) => out[i][1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = x1 - x0;
  for (const st of Object.keys(INSET)) {
    const [l1, l2, l0, lo0, ax, aw] = INSET[st];
    const idx = cs.map((c, i) => (c[2] === st ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const loc = idx.map((i) => albers(cs[i][4] > 0 ? cs[i][4] - 360 : cs[i][4], cs[i][3], l1, l2, l0, lo0));
    const lx0 = Math.min(...loc.map((p) => p[0])), lx1 = Math.max(...loc.map((p) => p[0]));
    const ly0 = Math.min(...loc.map((p) => p[1]));
    const k = (W * aw) / (lx1 - lx0 || 1);
    idx.forEach((i, j) => { out[i] = [x0 + W * ax + (loc[j][0] - lx0) * k, y0 - W * 0.05 + (loc[j][1] - ly0) * k - W * 0.12]; });
  }
  return out;
}

export default function UsMap({ onPick, height = 420 }: { onPick?: (c: C, slug: string | null) => void; height?: number }) {
  const router = useRouter();
  const [counties, setCounties] = useState<C[] | null>(null);
  const idx = useIndex() ?? [];
  const born = useRef(new Map<string, number>());
  const seen = useRef<Set<string> | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pts = useRef<{ x: number; y: number; i: number }[]>([]);

  useEffect(() => {
    // states, DC and Puerto Rico only: the Pacific territories would stretch the map across the globe
    fetch(`${DATA_BASE}/counties.json`).then((r) => r.json()).then((c: C[]) => setCounties(c.filter((x) => Number(x[2]) <= 56 || x[2] === "72"))).catch(() => {});
  }, []);

  useEffect(() => {
    const now = performance.now();
    if (seen.current) for (const i of idx) if (!seen.current.has(i.geoid)) born.current.set(i.geoid, now);
    seen.current = new Set(idx.map((i) => i.geoid));
    if (born.current.size) {
      let id = 0;
      const loop = () => { redraw.current(); if ([...born.current.values()].some((t) => performance.now() - t < 6000)) id = requestAnimationFrame(loop); };
      id = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(id);
    }
  }, [idx]);

  const planned = useMemo(() => new Map(idx.map((i) => [i.geoid, i.slug])), [idx]);
  const proj = useMemo(() => (counties ? projectAll(counties) : []), [counties]);

  useEffect(() => {
    const el = wrap.current, c = cv.current;
    if (!el || !c || !counties) return;
    const draw = () => {
      const W = el.clientWidth, H = height, dpr = window.devicePixelRatio || 1;
      c.width = W * dpr; c.height = H * dpr; c.style.height = H + "px";
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0f1b2d";
      ctx.fillRect(0, 0, W, H);
      const xs = proj.map((p) => p[0]), ys = proj.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const s = Math.min((W - 24) / (x1 - x0), (H - 24) / (y1 - y0));
      const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
      const P: { x: number; y: number; i: number }[] = [];
      const r = Math.max(1.3, Math.min(2.6, W / 520));
      ctx.fillStyle = "#33496d";
      counties.forEach((cc, i) => {
        const x = ox + (proj[i][0] - x0) * s, y = oy + (y1 - proj[i][1]) * s;
        P.push({ x, y, i });
        if (!planned.has(cc[0])) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      });
      ctx.fillStyle = "#4d8dff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      counties.forEach((cc, i) => {
        if (!planned.has(cc[0])) return;
        ctx.beginPath(); ctx.arc(P[i].x, P[i].y, r + 2.2, 0, 7); ctx.fill(); ctx.stroke();
      });
      // counties that just finished planning flash a growing ring
      const nowT = performance.now();
      counties.forEach((cc, i) => {
        const t = born.current.get(cc[0]);
        if (t === undefined || nowT - t > 6000) return;
        const k = (nowT - t) / 6000;
        ctx.strokeStyle = "#ffb81c";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P[i].x, P[i].y, r + 4 + k * 26, 0, 7); ctx.globalAlpha = 1 - k; ctx.stroke(); ctx.globalAlpha = 1;
      });
      pts.current = P;
    };
    redraw.current = draw;
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [counties, proj, planned, height]);

  function nearest(e: React.PointerEvent) {
    const r = cv.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 100;
    for (const p of pts.current) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.i; } }
    return { best, x, y };
  }

  return (
    <div>
      <div ref={wrap} style={{ position: "relative", borderRadius: 3, overflow: "hidden" }}>
        <canvas
          ref={cv}
          style={{ display: "block", width: "100%", cursor: "pointer" }}
          role="img"
          aria-label={`Map of every U.S. county. ${planned.size} have full plans.`}
          onPointerMove={(e) => { const { best, x, y } = nearest(e); setTip(best >= 0 && counties ? { x, y, text: `${counties[best][1]}${planned.has(counties[best][0]) ? " · planned" : ""}` } : null); }}
          onPointerLeave={() => setTip(null)}
          onClick={(e) => { const { best } = nearest(e as unknown as React.PointerEvent); if (best >= 0 && counties) { const cc = counties[best], sl = planned.get(cc[0]) ?? null; if (onPick) onPick(cc, sl); else router.push(sl ? `/county?county=${sl}` : `/explore?st=${cc[2]}&q=${encodeURIComponent(cc[1].replace(" County", ""))}`); } }}
        />
        {tip && <div style={{ position: "absolute", left: Math.min(tip.x + 12, 9999), top: tip.y + 12, background: "#fff", color: "#0f1b2d", padding: "4px 8px", fontSize: 13, fontWeight: 600, pointerEvents: "none", borderRadius: 2, whiteSpace: "nowrap" }}>{tip.text}</div>}
        <div style={{ position: "absolute", left: 14, top: 12, color: "#fff" }}>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{planned.size.toLocaleString("en-US")} <span style={{ fontSize: 15, fontWeight: 600, color: "#aebad0" }}>of {counties?.length.toLocaleString("en-US") ?? "3,235"} counties</span></div>
        </div>
      </div>
    </div>
  );
}
