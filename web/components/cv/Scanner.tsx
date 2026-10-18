"use client";
import { useEffect, useState } from "react";
import { agreement, Box } from "@/lib/iou";

type Img = { id: string; url: string; capturedAt?: number; lon: number; lat: number; meters: number; boxes: Box[] };
type Out = { boxes: Box[]; ms: number };

export default function Scanner({ lat, lon }: { lat: number; lon: number }) {
  const [state, setState] = useState<{ kind: "idle" | "loading" | "ready" | "off" | "error"; images?: Img[]; msg?: string }>({ kind: "idle" });
  const [out, setOut] = useState<Record<string, Out>>({});
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    setOut({});
    setSel(0);
    fetch(`/api/streetview?lat=${lat}&lon=${lon}&n=6`).then((r) => r.json()).then((j) => {
      if (!live) return;
      if (!j.configured) setState({ kind: "off" });
      else if (j.error) setState({ kind: "error", msg: j.error });
      else setState({ kind: "ready", images: j.images });
    }).catch(() => live && setState({ kind: "error", msg: "Could not load street photos." }));
    return () => { live = false; };
  }, [lat, lon]);

  async function detect(img: Img) {
    const r = await fetch(`/api/detect?u=${encodeURIComponent(img.url)}&t=0.12`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Detector error");
    return { boxes: j.boxes as Box[], ms: j.ms as number };
  }

  async function scan() {
    if (state.kind !== "ready" || !state.images) return;
    setRunning(true);
    try {
      let i = 0;
      for (const img of state.images) {
        setSel(i);
        setStatus(i === 0 ? "Loading the detector on first use, then scanning…" : `Scanning photo ${i + 1} of ${state.images.length}…`);
        const o = await detect(img);
        setOut((p) => ({ ...p, [img.id]: o }));
        i++;
      }
      setStatus("Done.");
    } catch (e: any) {
      setStatus("The detector could not run here: " + (e?.message ?? e));
    } finally {
      setRunning(false);
    }
  }

  if (state.kind === "loading") return <p style={{ marginTop: 12 }}>Loading street photos…</p>;
  if (state.kind === "off") return <p className="box soft" style={{ marginTop: 12 }}>Street photos are not connected on this server. Set <code>MAPILLARY_TOKEN</code> to turn them on.</p>;
  if (state.kind === "error") return <p className="box red" style={{ marginTop: 12 }} role="alert">{state.msg}</p>;
  if (state.kind !== "ready" || !state.images) return null;
  const images = state.images;
  if (!images.length) return <p style={{ marginTop: 12 }}>No street photos within 130 m of this spot.</p>;

  const cur = images[Math.min(sel, images.length - 1)];
  const o = out[cur.id];
  let tp = 0, fp = 0, fn = 0, ours = 0, ref = 0;
  for (const im of images) {
    const r = out[im.id];
    if (!r) continue;
    const a = agreement(r.boxes, im.boxes);
    tp += a.tp; fp += a.fp; fn += a.fn; ours += r.boxes.length; ref += im.boxes.length;
  }
  const scanned = Object.keys(out).length;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="photowrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="photo" src={`/api/img?u=${encodeURIComponent(cur.url)}`} alt="Street-level photo near the selected home" />
        {cur.boxes.map((b, i) => <div key={"m" + i} className="boxd" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />)}
        {o?.boxes.map((b, i) => <div key={"o" + i} className="boxd ours" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}><span>{Math.round((b.score ?? 0) * 100)}%</span></div>)}
        {running && <div className="scanline" aria-hidden="true" />}
      </div>
      <div className="thumbs">
        {images.map((im, i) => (
          <button key={im.id} className={i === sel ? "on" : ""} onClick={() => setSel(i)} aria-label={`Photo ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/img?u=${encodeURIComponent(im.url)}`} alt="" loading="lazy" />
            <b>{out[im.id] ? out[im.id].boxes.length : "·"}</b>
          </button>
        ))}
      </div>
      <p className="small" style={{ marginTop: 6 }}>
        Photo {sel + 1} of {images.length}, {cur.meters} m away{cur.capturedAt ? `, taken ${new Date(cur.capturedAt).getFullYear()}` : ""}. Amber boxes: Mapillary&apos;s detector ({cur.boxes.length}).
        {o ? ` Blue boxes: FiberPath's detector (${o.boxes.length}, ${(o.ms / 1000).toFixed(1)} s).` : ""}
      </p>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={scan} disabled={running}>{running ? "Scanning…" : scanned ? "Scan again" : "Run the detector on these photos"}</button>
      </div>
      {(running || status) && <p className="small" style={{ marginTop: 8 }}>{status}</p>}
      {scanned === images.length && (
        <div className="stats" style={{ marginTop: 14 }}>
          <div className="stat"><div className="big sm">{ours}</div><span className="label">Poles found by FiberPath</span></div>
          <div className="stat"><div className="big sm">{ref}</div><span className="label">Poles found by Mapillary</span></div>
          <div className="stat"><div className="big sm">{tp}</div><span className="label">Found by both</span></div>
        </div>
      )}
      {scanned === images.length && (
        <p style={{ marginTop: 10 }}>
          {ours > 0 || ref > 0 ? "Poles are visible along this road, so fiber can be priced as hung on poles." : "No poles were seen in these photos."}
          {" "}Precision {ours ? Math.round((tp / ours) * 100) : 0}%, recall {ref ? Math.round((tp / ref) * 100) : 0}% against Mapillary on {images.length} photos. A small sample, but it is a measured number.
        </p>
      )}
    </div>
  );
}
