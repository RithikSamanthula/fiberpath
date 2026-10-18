"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIndex } from "@/lib/useIndex";

type Box = { x: number; y: number; w: number; h: number; score?: number };
type Item = { id: string; url: string; lat: number; lon: number; county: string; boxes: Box[] };
type Saved = { id: string; lat: number; lon: number; county: string; at: string; boxes: (Box & { ok: boolean })[]; missed: Box[] };

// counties whose photos the detector trained on, so they are not used for checking it
const TRAINED = new Set(["13281", "13059", "42093", "48397", "22121", "18163", "29227", "29199", "54073", "21041", "37089", "12125", "13247", "13121"]);
const KEY = "fiberpath-handchecks-v1";
const px = (u: string) => `/api/img?u=${encodeURIComponent(u)}`;

export default function Label() {
  const index = useIndex();
  const [item, setItem] = useState<Item | null>(null);
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<Record<number, boolean | null>>({}); // null pending, true real, false not a pole
  const [extra, setExtra] = useState<Box[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [ratio, setRatio] = useState(0.5625);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; x2: number; y2: number } | null>(null);

  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);

  const next = useCallback(async () => {
    if (!index?.length) return;
    setItem(null); setMsg("Finding a street photo");
    for (let t = 0; t < 8; t++) {
      const pool = index.filter((c) => !TRAINED.has(c.geoid));
      const c = pool[Math.floor(Math.random() * pool.length)];
      try {
        const rs = await fetch(`/api/randomstreet?geoid=${c.geoid}&slug=${c.slug}`);
        if (!rs.ok) continue;
        const p = await rs.json();
        const sv = await fetch(`/api/streetview?lat=${p.lat}&lon=${p.lon}&n=3`).then((r) => r.json());
        const im = sv.images?.[Math.floor(Math.random() * (sv.images?.length || 1))];
        if (!im) continue;
        const d = await fetch(`/api/detect?u=${encodeURIComponent(im.url)}&t=0.3`).then((r) => r.json());
        if (!d.boxes) continue;
        const boxes: Box[] = d.boxes.filter((b: { cls?: number }) => (b.cls ?? 0) === 0);
        setItem({ id: String(im.id), url: im.url, lat: im.lat, lon: im.lon, county: `${c.name}, ${c.state}`, boxes });
        setState({}); setExtra([]); setMsg("");
        return;
      } catch {}
    }
    setMsg("Could not find a photo. Try again.");
  }, [index]);
  useEffect(() => { if (index && !item && !msg) next(); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => {
    const c = cv.current, im = img.current;
    if (!c || !im || !im.complete || !im.naturalWidth || !item) return;
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(im, 0, 0, W, H);
    item.boxes.forEach((b, i) => {
      const s = state[i] ?? null;
      const col = s === true ? "#38c47c" : s === false ? "#ff5a4a" : "#4d8dff";
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
      ctx.fillStyle = col; ctx.fillRect(b.x * W - 1.5, Math.max(0, b.y * H - 22), 24, 22);
      ctx.fillStyle = "#fff"; ctx.font = "700 13px sans-serif"; ctx.fillText(String(i + 1), b.x * W + 6, Math.max(15, b.y * H - 6));
      if (s === false) { ctx.beginPath(); ctx.moveTo(b.x * W, b.y * H); ctx.lineTo((b.x + b.w) * W, (b.y + b.h) * H); ctx.moveTo((b.x + b.w) * W, b.y * H); ctx.lineTo(b.x * W, (b.y + b.h) * H); ctx.stroke(); }
    });
    ctx.strokeStyle = "#ffb81c"; ctx.setLineDash([6, 4]); ctx.lineWidth = 3;
    for (const b of extra) ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
    const d = drag.current;
    if (d) ctx.strokeRect(Math.min(d.x, d.x2) * W, Math.min(d.y, d.y2) * H, Math.abs(d.x2 - d.x) * W, Math.abs(d.y2 - d.y) * H);
    ctx.setLineDash([]);
  }, [item, state, extra]);

  useEffect(() => {
    if (!item) return;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => { setRatio(im.naturalHeight / im.naturalWidth); requestAnimationFrame(draw); };
    im.src = px(item.url);
    img.current = im;
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { draw(); }, [draw, ratio]);

  // click a box to mark it real, click again for not a pole, again to clear; drag on empty space to add a missed pole
  useEffect(() => {
    const c = cv.current;
    if (!c || !item) return;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    let moved = false, start: number[] | null = null;
    const down = (e: PointerEvent) => { c.setPointerCapture(e.pointerId); start = pos(e); moved = false; drag.current = null; };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const p = pos(e);
      if (Math.hypot(p[0] - start[0], p[1] - start[1]) > 0.012) { moved = true; drag.current = { x: start[0], y: start[1], x2: p[0], y2: p[1] }; draw(); }
    };
    const up = (e: PointerEvent) => {
      const p = pos(e);
      if (moved && start) {
        const b = { x: Math.min(start[0], p[0]), y: Math.min(start[1], p[1]), w: Math.abs(p[0] - start[0]), h: Math.abs(p[1] - start[1]) };
        if (b.w > 0.004 && b.h > 0.03) setExtra((x) => [...x, b]);
      } else if (start) {
        const hit = item.boxes.findIndex((b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h);
        const ex = extra.findIndex((b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h);
        if (hit >= 0) setState((s) => ({ ...s, [hit]: s[hit] === true ? false : s[hit] === false ? null : true }));
        else if (ex >= 0) setExtra((x) => x.filter((_, i) => i !== ex));
      }
      start = null; drag.current = null; draw();
    };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); };
  }, [item, extra, draw]);

  const done = (skip: boolean) => {
    if (!item) return;
    if (!skip) {
      const rec: Saved = { id: item.id, lat: item.lat, lon: item.lon, county: item.county, at: new Date().toISOString(), boxes: item.boxes.map((b, i) => ({ ...b, ok: state[i] !== false })), missed: extra };
      const all = [...saved, rec];
      setSaved(all);
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
      fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) }).catch(() => {});
    }
    next();
  };

  const stats = (() => {
    let real = 0, fake = 0, missed = 0;
    for (const s of saved) { for (const b of s.boxes) b.ok ? real++ : fake++; missed += s.missed.length; }
    return { photos: saved.length, real, fake, missed, p: real + fake ? real / (real + fake) : null, r: real + missed ? real / (real + missed) : null };
  })();
  const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);

  return (
    <main className="wrap page" style={{ maxWidth: 1100 }}>
      <h1>Check the pole detector</h1>
      <p className="lede">Each photo shows what the detector marked as a utility pole. Tell us what it got right.</p>
      <ul className="small" style={{ margin: "12px 0 0 20px", display: "grid", gap: 4 }}>
        <li><b>Click a box</b> once if it is a real utility pole (green), twice if it is not (red). Boxes you leave blue count as real.</li>
        <li><b>Drag on the photo</b> to draw a box around a utility pole the detector missed. Click a dashed box to remove it.</li>
        <li>A utility pole carries power or phone wires. Street lights, signs and trees do not count. If you cannot tell, press Skip.</li>
      </ul>

      <div className="street-grid" style={{ gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)" }}>
        <div>
          {!item && <div style={{ background: "#0a1424", color: "#aebad0", display: "grid", placeItems: "center", height: 380 }}>{msg || "Loading"}</div>}
          {item && (
            <div ref={wrap} style={{ position: "relative", width: "100%", paddingTop: `${ratio * 100}%`, background: "#0a1424" }}>
              <canvas ref={cv} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair", touchAction: "none" }} aria-label="Street photo with detector boxes" />
            </div>
          )}
          {item && <p className="small" style={{ marginTop: 6 }}>{item.county}. Photo from Mapillary contributors.</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={!item} onClick={() => done(false)}>Save and next</button>
            <button className="btn line" disabled={!item} onClick={() => done(true)}>Skip</button>
            {item && <span className="small">{item.boxes.length} marked, {extra.length} added by you</span>}
          </div>
        </div>
        <div>
          <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="stat"><div className="big sm">{stats.photos}</div><span className="label">Photos checked</span></div>
            <div className="stat"><div className="big sm">{pct(stats.p)}</div><span className="label">Marks that were real</span></div>
            <div className="stat"><div className="big sm">{pct(stats.r)}</div><span className="label">Poles it found</span></div>
            <div className="stat"><div className="big sm">{stats.missed}</div><span className="label">Poles it missed</span></div>
          </div>
          <p className="small" style={{ marginTop: 10 }}>Aim for about 100 photos. These numbers come from your own answers, so they are a hand-checked score for the detector. The photos come from counties the detector was not trained on.</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn sm line" disabled={!saved.length} onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(saved, null, 1)], { type: "application/json" })); a.download = "fiberpath-handchecks.json"; a.click(); }}>Download answers</button>
            <button className="btn sm line" disabled={!saved.length} onClick={() => { if (confirm("Delete all saved answers in this browser?")) { setSaved([]); try { localStorage.removeItem(KEY); } catch {} } }}>Clear</button>
          </div>
        </div>
      </div>
    </main>
  );
}
