"use client";
import "mapillary-js/dist/mapillary.css";
import { useEffect, useMemo, useRef, useState } from "react";
import PhotoDetect from "@/components/cv/PhotoDetect";
import PoleScene3D from "./PoleScene3D";
import { compare, Det, Frame, locate } from "@/lib/poleLocate";

type Mode = "explore" | "ride";
const TOKEN = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN;
const px = (u: string) => `/api/img?u=${encodeURIComponent(u)}`;

export default function StreetExplorer({ lat, lon, onMove }: { lat: number; lon: number; onMove?: (lat: number, lon: number) => void }) {
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dets, setDets] = useState<Record<number, Det[]>>({});
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>("explore");
  const camH = 1.6;
  const [ref, setRef] = useState<[number, number][]>([]);
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    let live = true;
    const my = ++run.current;
    setFrames(null); setDets({}); setErr(null); setSel(0); setPlaying(false);
    fetch(`/api/sequence?lat=${lat}&lon=${lon}&n=24`).then((r) => r.json()).then(async (j) => {
      if (!live) return;
      if (!j.configured) { setErr("Street photos are not set up on this server"); return; }
      if (j.error) { setErr(j.error); return; }
      if (!j.frames?.length) { setErr("No street photos along a road near this spot"); return; }
      const fr: Frame[] = j.frames;
      setFrames(fr);
      setSel(Math.floor(fr.length / 2));
      fetch(`/api/refpoles?lat=${fr[0].lat}&lon=${fr[0].lon}`).then((r) => r.json()).then((x) => live && setRef(x.poles ?? [])).catch(() => {});
      setBusy(true);
      // detect outward from the middle so the part you are looking at is ready first
      const order = fr.map((_, i) => i).sort((a, b) => Math.abs(a - fr.length / 2) - Math.abs(b - fr.length / 2));
      for (const i of order) {
        if (run.current !== my) return;
        try {
          const r = await fetch(`/api/detect?u=${encodeURIComponent(fr[i].url)}&t=0.3`);
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Detector error");
          if (run.current !== my) return;
          setDets((p) => ({ ...p, [i]: d.boxes }));
        } catch (e: any) { setErr(e?.message ?? "Detector error"); break; }
      }
      if (run.current === my) setBusy(false);
    }).catch(() => live && setErr("Could not load street photos"));
    return () => { live = false; };
  }, [lat, lon]);

  const result = useMemo(() => (frames ? locate(frames, frames.map((_, i) => dets[i]), camH) : { obs: [], poles: [] }), [frames, dets, camH]);
  const cmp = useMemo(() => compare(result.poles, ref), [result.poles, ref]);
  const done = Object.keys(dets).length;
  const pathM = useMemo(() => {
    if (!frames) return 0;
    const kx = 111320 * Math.cos((frames[0].lat * Math.PI) / 180);
    return frames.slice(1).reduce((s, f, i) => s + Math.hypot((f.lon - frames[i].lon) * kx, (f.lat - frames[i].lat) * 110574), 0);
  }, [frames]);
  const per100 = pathM ? (result.poles.length / pathM) * 100 : 0;
  const withPole = frames ? frames.filter((_, i) => (dets[i] ?? []).some((d) => (d.cls ?? 0) === 0)).length : 0;
  const share = frames?.length ? withPole / frames.length : 0;
  const aerial = share >= 0.5 || per100 >= 0.8;
  const finished = frames && done === frames.length;

  // ride-along clock
  useEffect(() => {
    if (!playing || !frames) return;
    const t = setInterval(() => setSel((s) => { if (s >= frames.length - 1) { setPlaying(false); return s; } return s + 1; }), 450);
    return () => clearInterval(t);
  }, [playing, frames]);

  if (err && !frames) return <p className="box red wrap" role="alert" style={{ margin: "32px auto" }}>{err}</p>;
  if (!frames) return <p className="wrap" style={{ padding: "40px 20px" }}>Finding street photos along this road</p>;
  const cur = frames[Math.min(sel, frames.length - 1)];
  const curDets = dets[sel];
  const seenSoFar = result.poles.filter((p) => p.firstFrame <= sel).length;

  return (
    <div className="street-grid">
      <div style={{ minWidth: 0 }}>
        <div className="row noprint" style={{ marginBottom: 8, justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 0 }}>
            <button className="btn sm line" aria-pressed={mode === "explore"} onClick={() => { setMode("explore"); setPlaying(false); }}>Look around</button>
            <button className="btn sm line" aria-pressed={mode === "ride"} onClick={() => { setMode("ride"); setSel(0); setPlaying(true); }}>Ride along</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {onMove && <button className="btn sm line" onClick={() => onMove(frames[0].lat, frames[0].lon)}>‹ Back along the road</button>}
            {onMove && <button className="btn sm line" onClick={() => onMove(frames[frames.length - 1].lat, frames[frames.length - 1].lon)}>Ahead along the road ›</button>}
            <span className="small">{done} of {frames.length} photos checked</span>
          </div>
        </div>

        {mode === "explore" ? (
          <Viewer frames={frames} dets={dets} sel={sel} onSel={setSel} />
        ) : (
          <div style={{ position: "relative" }}>
            <PhotoDetect key={cur.id} src={px(cur.url)} boxes={curDets} stage={curDets ? "final" : "photo"} animate={false} ratio={0.62} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(10,20,36,0.88)", color: "#fff", padding: "10px 14px", display: "flex", gap: 22, flexWrap: "wrap", alignItems: "baseline" }}>
              <span><b style={{ fontSize: 26 }}>{seenSoFar}</b> <span className="small">poles passed</span></span>
              <span><b style={{ fontSize: 26 }}>{Math.round((sel / Math.max(1, frames.length - 1)) * pathM)}</b> <span className="small">m driven</span></span>
              <span className="small" style={{ marginLeft: "auto" }}>frame {sel + 1} / {frames.length}</span>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "#33496d" }}><i style={{ display: "block", height: 4, width: `${((sel + 1) / frames.length) * 100}%`, background: "#4d8dff" }} /></div>
          </div>
        )}

        <div className="thumbs" style={{ gridTemplateColumns: `repeat(${Math.min(12, frames.length)}, 1fr)`, marginTop: 6 }}>
          {frames.map((f, i) => {
            const n = dets[i] ? dets[i].filter((d) => (d.cls ?? 0) === 0).length : null;
            return (
              <button key={f.id} className={i === sel ? "on" : ""} onClick={() => { setSel(i); setPlaying(false); }} aria-label={`Photo ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={px(f.url)} alt="" loading="lazy" />
                <b>{n === null ? "·" : n}</b>
              </button>
            );
          })}
        </div>
        {mode === "ride" && <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { if (sel >= frames.length - 1) setSel(0); setPlaying((p) => !p); }}>{playing ? "Pause" : "Play"}</button></div>}
        {err && <p className="box red" style={{ marginTop: 8 }} role="alert">{err}</p>}
      </div>

      <div style={{ minWidth: 0, display: "grid", gap: 12, alignContent: "start" }}>
        <div style={{ height: 380, borderRadius: 3, overflow: "hidden" }}>
          <PoleScene3D frames={frames} obs={result.obs} poles={result.poles} ref={ref} current={sel} camH={camH} />
        </div>
        <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat" style={{ padding: 14 }}><div className="big sm">{result.poles.length}</div><span className="label">Poles placed</span></div>
          <div className="stat" style={{ padding: 14 }}><div className="big sm">{result.poles.length ? (result.poles.reduce((s, p) => s + p.views, 0) / result.poles.length).toFixed(1) : "—"}</div><span className="label">Photos per pole</span></div>
          <div className="stat" style={{ padding: 14 }}><div className="big sm">{cmp?.median != null ? `${cmp.median.toFixed(1)} m` : "—"}</div><span className="label">Typical miss</span></div>
        </div>
        <p className="small">
          {cmp ? `${cmp.matched} of ${cmp.of} placed poles are within 15 m of a pole Mapillary had already mapped. The typical miss is ${cmp.median?.toFixed(1)} m` : "The miss is measured against poles others already mapped nearby"}
        </p>
        {finished && (
          <div className={`box ${aerial ? "blue" : "inv"}`}>
            <p className="label">This {Math.round(pathM)} m of road</p>
            <p className="big sm" style={{ marginTop: 6 }}>{aerial ? "Fiber on poles" : "Buried fiber"}</p>
            <p className="small" style={{ marginTop: 6 }}>Poles show up in {withPole} of {frames.length} photos ({Math.round(share * 100)}%), about {per100.toFixed(1)} per 100 m. If poles show in half the photos or there are 0.8 per 100 m, the road is priced as fiber on poles. Otherwise it is priced as buried.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Viewer({ frames, dets, sel, onSel }: { frames: Frame[]; dets: Record<number, Det[]>; sel: number; onSel: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const lib = useRef<any>(null);
  const [fallback, setFallback] = useState(!TOKEN);
  const idToIdx = useMemo(() => new Map(frames.map((f, i) => [f.id, i])), [frames]);
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => {
    if (!TOKEN || !box.current) return;
    let dead = false;
    (async () => {
      try {
        const m = await import("mapillary-js");
        if (dead) return;
        lib.current = m;
        const v = new m.Viewer({ accessToken: TOKEN, container: box.current!, imageId: frames[selRef.current].id, component: { cover: false, tag: true, bearing: false, direction: true, sequence: false } });
        viewer.current = v;
        v.on("image", (e: any) => { const i = idToIdx.get(e.image.id); if (i !== undefined) onSel(i); });
      } catch { setFallback(true); }
    })();
    return () => { dead = true; try { viewer.current?.remove(); } catch {} viewer.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames]);

  // jump when a thumbnail is picked
  useEffect(() => {
    const v = viewer.current;
    if (v && frames[sel] && v.isNavigable !== false) v.moveTo(frames[sel].id).catch(() => {});
  }, [sel, frames]);

  // draw the detections as tags on the photo
  useEffect(() => {
    const v = viewer.current, m = lib.current;
    if (!v || !m) return;
    const d = dets[sel] ?? [];
    try {
      const tag = v.getComponent("tag");
      tag.set(d.map((b, k) => {
        const util = (b.cls ?? 0) === 0;
        return new m.OutlineTag(`d${sel}-${k}`, new m.RectGeometry([b.x, b.y, b.x + b.w, b.y + b.h]), {
          lineColor: util ? 0x4d8dff : 0xffffff, lineWidth: util ? 3 : 2, fillColor: util ? 0x4d8dff : 0xffffff, fillOpacity: util ? 0.18 : 0.08,
          text: util ? `Utility pole ${Math.round(b.score * 100)}%` : "Street light, left out", textColor: 0xffffff,
        });
      }));
    } catch {}
  }, [dets, sel]);

  if (fallback) {
    const f = frames[sel];
    return (
      <div style={{ position: "relative" }}>
        <PhotoDetect key={f.id} src={px(f.url)} boxes={dets[sel]} stage={dets[sel] ? "final" : "photo"} animate={false} ratio={0.62} />
        <div style={{ position: "absolute", inset: "auto 0 50% 0", display: "flex", justifyContent: "space-between", padding: "0 8px" }}>
          <button className="btn sm dark" onClick={() => onSel(Math.max(0, sel - 1))} aria-label="Back">‹</button>
          <button className="btn sm dark" onClick={() => onSel(Math.min(frames.length - 1, sel + 1))} aria-label="Forward">›</button>
        </div>
      </div>
    );
  }
  return <div ref={box} style={{ width: "100%", height: 480, background: "#0a1424", borderRadius: 3, overflow: "hidden" }} aria-label="Interactive street view" />;
}
