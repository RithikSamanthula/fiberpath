"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import PoleScene3D from "@/components/street/PoleScene3D";
import { Det, Frame, locate } from "@/lib/poleLocate";
import { detectFrame, loadModel } from "@/lib/yoloWeb";

type Mode = "idle" | "camera" | "replay";
const px = (u: string) => `/api/img?u=${encodeURIComponent(u)}`;
const rad = (d: number) => (d * Math.PI) / 180;

function backHeading(a: number, b: number, g: number) {
  const x = rad(b), y = rad(g), z = rad(a);
  const cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
  const vx = -cZ * sY - sZ * sX * cY, vy = -sZ * sY + cZ * sX * cY;
  let h = Math.atan(vx / vy);
  if (vy < 0) h += Math.PI; else if (vx < 0) h += 2 * Math.PI;
  return (h * 180) / Math.PI;
}

export default function LiveView({ startLat, startLon }: { startLat: number; startLon: number }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [dets, setDets] = useState<(Det[] | undefined)[]>([]);
  const [cur, setCur] = useState(-1);
  const [fps, setFps] = useState<number | null>(null);
  const [gps, setGps] = useState<{ acc: number; heading: number | null } | null>(null);
  const [ref, setRef] = useState<[number, number][]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const live = useRef({ lat: 0, lon: 0, acc: 99, heading: null as number | null, boxes: [] as Det[] });
  const run = useRef(0);

  useEffect(() => { loadModel().then(() => setReady(true)).catch(() => setStatus("The detector could not load in this browser.")); }, []);

  const drawBoxes = (boxes: Det[], w: number, h: number) => {
    const c = over.current;
    if (!c) return;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = Math.max(3, w / 300);
    ctx.font = `700 ${Math.max(13, w / 55)}px -apple-system, Helvetica, Arial, sans-serif`;
    for (const b of boxes) {
      const util = (b.cls ?? 0) === 0;
      ctx.strokeStyle = util ? "#4d8dff" : "#ffffff";
      ctx.strokeRect(b.x * w, b.y * h, b.w * w, b.h * h);
      const label = util ? `Utility pole ${Math.round(b.score * 100)}%` : "Street light";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = util ? "#4d8dff" : "rgba(15,27,45,0.85)";
      ctx.fillRect(b.x * w, Math.max(0, b.y * h - 24), tw, 22);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, b.x * w + 5, Math.max(16, b.y * h - 8));
    }
  };

  const keep = (f: Frame, boxes: Det[]) => {
    setFrames((fs) => {
      const last = fs[fs.length - 1];
      const kx = 111320 * Math.cos(rad(f.lat));
      const moved = last ? Math.hypot((f.lon - last.lon) * kx, (f.lat - last.lat) * 110574) : 99;
      const turned = last ? Math.abs(((f.heading - last.heading + 540) % 360) - 180) : 99;
      if (moved < 3 && turned < 20) return fs;
      setDets((d) => [...d.slice(-59), boxes]);
      setCur(Math.min(fs.length, 59));
      return [...fs.slice(-59), f];
    });
  };

  async function stop() { run.current++; const v = video.current; if (v?.srcObject) { (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); v.srcObject = null; } setMode("idle"); setFps(null); }

  async function startCamera() {
    const my = ++run.current;
    setFrames([]); setDets([]); setStatus("Asking for the camera and location");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      const v = video.current!;
      v.srcObject = stream; v.setAttribute("playsinline", "true"); await v.play();
      const DO: any = (window as any).DeviceOrientationEvent;
      if (DO?.requestPermission) { try { await DO.requestPermission(); } catch {} }
      const onOri = (e: any) => {
        const h = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : e.absolute && e.alpha != null ? backHeading(e.alpha, e.beta ?? 0, e.gamma ?? 0) : null;
        if (h != null) { live.current.heading = h; setGps((g) => ({ acc: g?.acc ?? 99, heading: h })); }
      };
      window.addEventListener("deviceorientationabsolute", onOri as any, true);
      window.addEventListener("deviceorientation", onOri as any, true);
      const wid = navigator.geolocation.watchPosition((p) => { live.current.lat = p.coords.latitude; live.current.lon = p.coords.longitude; live.current.acc = p.coords.accuracy; setGps((g) => ({ acc: p.coords.accuracy, heading: g?.heading ?? null })); }, () => setStatus("Location is turned off, so allow it if you want poles placed on the map."), { enableHighAccuracy: true, maximumAge: 1000 });
      setMode("camera"); setStatus("");
      let n = 0, t0 = performance.now();
      while (run.current === my) {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w) { await new Promise((r) => setTimeout(r, 100)); continue; }
        const boxes = await detectFrame(v, w, h);
        if (run.current !== my) break;
        drawBoxes(boxes, w, h);
        live.current.boxes = boxes;
        n++; if (n % 3 === 0) setFps((n / ((performance.now() - t0) / 1000)));
        const L = live.current;
        if (L.lat && L.heading != null && L.acc < 40 && boxes.some((b) => (b.cls ?? 0) === 0)) keep({ id: String(n), lon: L.lon, lat: L.lat, heading: L.heading, focal: 0.77, w, h, url: "" }, boxes);
      }
      window.removeEventListener("deviceorientationabsolute", onOri as any, true);
      window.removeEventListener("deviceorientation", onOri as any, true);
      navigator.geolocation.clearWatch(wid);
    } catch (e: any) {
      setStatus(e?.name === "NotAllowedError" ? "Camera permission was declined." : "This device does not have a usable camera here, so try the replay instead.");
      setMode("idle");
    }
  }

  async function startReplay() {
    const my = ++run.current;
    setFrames([]); setDets([]); setCur(-1); setMode("replay"); setStatus("Loading a recorded drive");
    try {
      const j = await fetch(`/api/sequence?lat=${startLat}&lon=${startLon}&n=30`).then((r) => r.json());
      const fr: Frame[] = j.frames ?? [];
      if (!fr.length) { setStatus("No street photos here."); setMode("idle"); return; }
      setStatus("");
      fetch(`/api/refpoles?lat=${fr[0].lat}&lon=${fr[0].lon}`).then((r) => r.json()).then((x) => setRef(x.poles ?? [])).catch(() => {});
      const all: Frame[] = [], allD: Det[][] = [];
      for (let i = 0; i < fr.length && run.current === my; i++) {
        const im = new Image(); im.crossOrigin = "anonymous"; im.src = px(fr[i].url);
        await new Promise((r) => { im.onload = r; im.onerror = r; });
        const t = performance.now();
        const boxes = await detectFrame(im, im.naturalWidth, im.naturalHeight);
        if (run.current !== my) return;
        const c = video.current;
        drawReplay(im, boxes);
        all.push(fr[i]); allD.push(boxes);
        setFrames([...all]); setDets([...allD]); setCur(i); setFps(1000 / (performance.now() - t));
        await new Promise((r) => setTimeout(r, 500));
        void c;
      }
      setStatus("Replay finished");
    } catch { setStatus("Could not load the recorded drive."); setMode("idle"); }
  }
  const replayCv = useRef<HTMLCanvasElement>(null);
  const drawReplay = (im: HTMLImageElement, boxes: Det[]) => {
    const c = replayCv.current;
    if (!c) return;
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext("2d")!.drawImage(im, 0, 0);
    drawBoxes(boxes, im.naturalWidth, im.naturalHeight);
  };

  useEffect(() => () => { run.current++; }, []);
  const result = useMemo(() => (frames.length ? locate(frames, dets) : { obs: [], poles: [] }), [frames, dets]);
  const poleCount = result.poles.length;
  const seen = dets.reduce((s, d) => s + (d?.filter((b) => (b.cls ?? 0) === 0).length ?? 0), 0);

  return (
    <div className="street-grid">
      <div style={{ minWidth: 0 }}>
        <div style={{ position: "relative", background: "#080808", borderRadius: 0, overflow: "hidden", minHeight: 300 }}>
          <video ref={video} playsInline muted style={{ width: "100%", display: mode === "camera" ? "block" : "none" }} />
          <canvas ref={replayCv} style={{ width: "100%", display: mode === "replay" ? "block" : "none" }} />
          <canvas ref={over} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: mode === "camera" ? "block" : "none", pointerEvents: "none" }} />
          {mode === "idle" && <div style={{ display: "grid", placeItems: "center", minHeight: 360, color: "#b3b3b3", textAlign: "center", padding: 24 }}>{status || (ready ? "Detector ready" : "Loading the detector")}</div>}
          {fps !== null && <div style={{ position: "absolute", right: 10, top: 10, background: "rgba(15,27,45,0.85)", color: "#fff", padding: "4px 10px", fontSize: 13 }}>{fps.toFixed(1)} frames a second</div>}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {mode === "idle" ? (
            <>
              <button className="btn" onClick={startCamera} disabled={!ready}>Use my camera</button>
              <button className="btn line" onClick={startReplay} disabled={!ready}>Watch a recorded drive</button>
            </>
          ) : (
            <button className="btn dark" onClick={stop}>Stop</button>
          )}
        </div>
        {mode !== "idle" && status && <p className="small" style={{ marginTop: 8 }}>{status}</p>}
        <p className="small" style={{ marginTop: 10 }}>The detector runs on your device. Nothing from the camera is uploaded. Walk or ride along a road with the camera facing the poles, and the map fills in as your position and compass change.</p>
      </div>
      <div style={{ minWidth: 0, display: "grid", gap: 12, alignContent: "start" }}>
        <div style={{ height: 360, borderRadius: 0, overflow: "hidden" }}>
          <PoleScene3D frames={frames} obs={result.obs} poles={result.poles} ref={ref} current={cur} />
        </div>
        <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat" style={{ padding: 14 }}><div className="big sm">{seen}</div><span className="label">Poles seen</span></div>
          <div className="stat" style={{ padding: 14 }}><div className="big sm">{poleCount}</div><span className="label">Placed on the map</span></div>
          <div className="stat" style={{ padding: 14 }}><div className="big sm">{mode === "camera" ? (gps ? `±${Math.round(gps.acc)} m` : "-") : "-"}</div><span className="label">Location accuracy</span></div>
        </div>
        {mode === "camera" && <p className="small">Compass: {gps?.heading != null ? `${Math.round(gps.heading)} degrees` : "not available, so poles cannot be placed on the map"}</p>}
      </div>
    </div>
  );
}
