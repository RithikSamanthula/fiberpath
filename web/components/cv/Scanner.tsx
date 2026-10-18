"use client";
import { useEffect, useRef, useState } from "react";
import { agreement, Box } from "@/lib/iou";
import PhotoDetect from "./PhotoDetect";

type Img = { id: string; url: string; capturedAt?: number; lon: number; lat: number; meters: number; boxes: Box[] };
type Out = { boxes: Box[]; candidates: Box[]; ms: number };
type Stage = "photo" | "candidates" | "final";

const px = (u: string) => `/api/img?u=${encodeURIComponent(u)}`;

// Street photos near a point, with the pole detector run on all of them as soon as they load.
export default function Scanner({ lat, lon, ratio = 0.5625, onEmpty }: { lat: number; lon: number; ratio?: number; onEmpty?: (empty: boolean) => void }) {
  const [state, setState] = useState<{ kind: "loading" | "ready" | "off" | "error"; images?: Img[]; msg?: string }>({ kind: "loading" });
  const [out, setOut] = useState<Record<string, Out>>({});
  const [sel, setSel] = useState(0);
  const [stage, setStage] = useState<Stage>("final");
  const [ref, setRef] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    let live = true;
    const my = ++run.current;
    setState({ kind: "loading" }); setOut({}); setSel(0); setErr(null);
    fetch(`/api/streetview?lat=${lat}&lon=${lon}&n=6`).then((r) => r.json()).then(async (j) => {
      if (!live) return;
      if (!j.configured) { setState({ kind: "off" }); return; }
      if (j.error) { setState({ kind: "error", msg: j.error }); return; }
      const images: Img[] = j.images;
      setState({ kind: "ready", images });
      setBusy(true);
      let next = 0, failed = false;
      const worker = async () => {
        while (!failed && run.current === my) {
          const im = images[next++];
          if (!im) return;
          try {
            const r = await fetch(`/api/detect?u=${encodeURIComponent(im.url)}&t=0.3&debug=1`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Detector error");
            if (run.current !== my) return;
            setOut((p) => ({ ...p, [im.id]: { boxes: d.boxes, candidates: d.candidates ?? [], ms: d.ms } }));
          } catch (e: any) { failed = true; setErr(e?.message ?? "The detector could not run."); return; }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (run.current === my) setBusy(false);
    }).catch(() => live && setState({ kind: "error", msg: "Could not load street photos." }));
    return () => { live = false; };
  }, [lat, lon]);

  useEffect(() => { onEmpty?.(state.kind === "off" || state.kind === "error" || (state.kind === "ready" && !state.images?.length)); }, [state, onEmpty]);

  if (state.kind === "loading") return <div style={{ paddingTop: `${ratio * 100}%`, position: "relative", background: "#0a1424", borderRadius: 3 }}><span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#aebad0" }}>Finding street photos</span></div>;
  if (state.kind === "off") return <p className="box soft">Street photos are not set up on this server. Add <code>MAPILLARY_TOKEN</code> to turn them on.</p>;
  if (state.kind === "error") return <p className="box red" role="alert">{state.msg}</p>;
  const images = state.images ?? [];
  if (!images.length) return <p className="box soft">No street photos near this spot.</p>;

  const cur = images[Math.min(sel, images.length - 1)];
  const o = out[cur.id];
  const util = (b: Box[]) => b.filter((x) => (x.cls ?? 0) === 0);
  const nUtil = images.reduce((s, im) => s + (out[im.id] ? util(out[im.id].boxes).length : 0), 0);
  const nOther = images.reduce((s, im) => s + (out[im.id] ? out[im.id].boxes.length - util(out[im.id].boxes).length : 0), 0);
  const done = Object.keys(out).length;
  let tp = 0, fp = 0, fn = 0;
  for (const im of images) { const r = out[im.id]; if (!r) continue; const a = agreement(util(r.boxes), im.boxes); tp += a.tp; fp += a.fp; fn += a.fn; }
  const maxBar = Math.max(1, ...images.map((im) => (out[im.id] ? util(out[im.id].boxes).length : 0)));
  const verdict = done < images.length ? null : nUtil > 0;

  return (
    <div>
      <div style={{ position: "relative" }}>
        <PhotoDetect src={px(cur.url)} boxes={o?.boxes} candidates={o?.candidates} reference={ref ? cur.boxes : null} stage={o ? stage : "photo"} scanning={!o && busy && sel === images.indexOf(cur)} ratio={ratio} />
        <div style={{ position: "absolute", left: 10, top: 10, display: "flex", gap: 0 }}>
          {([["photo", "Photo"], ["candidates", "Proposals"], ["final", "Result"]] as [Stage, string][]).map(([k, l]) => (
            <button key={k} className="btn sm" style={{ borderRadius: 0, background: stage === k ? "#4d8dff" : "rgba(15,27,45,0.85)", borderColor: stage === k ? "#4d8dff" : "rgba(15,27,45,0.85)" }} onClick={() => setStage(k)} aria-pressed={stage === k}>{l}</button>
          ))}
        </div>
        {verdict !== null && (
          <div style={{ position: "absolute", right: 10, top: 10, background: verdict ? "#1b5fd1" : "#0f1b2d", color: "#fff", padding: "6px 12px", fontWeight: 800, letterSpacing: "0.04em", fontSize: 13, textTransform: "uppercase" }}>
            {verdict ? "Poles on this road" : "No poles seen"}
          </div>
        )}
        <div style={{ position: "absolute", left: 10, bottom: 10, background: "rgba(15,27,45,0.85)", color: "#fff", padding: "4px 10px", fontSize: 12 }}>
          {o ? `${util(o.boxes).length} utility pole${util(o.boxes).length === 1 ? "" : "s"}${o.boxes.length > util(o.boxes).length ? `, ${o.boxes.length - util(o.boxes).length} other` : ""} · ${(o.ms / 1000).toFixed(1)} s` : busy ? "Detecting" : ""}
        </div>
      </div>

      <div className="thumbs" style={{ gridTemplateColumns: `repeat(${Math.min(images.length, 6)}, 1fr)` }}>
        {images.map((im, i) => {
          const n = out[im.id] ? util(out[im.id].boxes).length : null;
          return (
            <button key={im.id} className={i === sel ? "on" : ""} onClick={() => setSel(i)} aria-label={`Photo ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={px(im.url)} alt="" loading="lazy" />
              <b>{n === null ? "·" : n}</b>
              {n !== null && <i style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${(n / maxBar) * 100}%`, background: "#4d8dff" }} />}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        <p className="small">{done} of {images.length} photos checked, {nUtil} utility poles{nOther ? `, ${nOther} street lights and other poles left out` : ""}</p>
        <button className="btn sm line" aria-pressed={ref} onClick={() => setRef((v) => !v)}>{ref ? "Hide" : "Compare with"} Mapillary</button>
      </div>
      {ref && done === images.length && <p className="small" style={{ marginTop: 4 }}>Against Mapillary&apos;s boxes on these photos: {tp} matched, {fp} extra, {fn} missed.</p>}
      {err && <p className="box red" style={{ marginTop: 8 }} role="alert">{err}</p>}
    </div>
  );
}
