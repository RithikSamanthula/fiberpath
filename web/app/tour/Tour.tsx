"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import DetectionDemo from "@/components/cv/DetectionDemo";
import FiberDemo from "@/components/cv/FiberDemo";
import UsMap from "@/components/UsMap";
import { HomesPanel, NetworkPanel, TerrainPanel, WirelessPanel } from "@/components/visuals/Panels";

const SCENES = [
  { title: "A county with thousands of homes", text: "Towns County, Georgia has about 10,000 homes. FiberPath starts by finding every one of them from satellite building outlines.", vis: <HomesPanel /> },
  { title: "Some of them have no good internet", text: "Many homes sit far from town. They have no internet at the federal minimum speed, and nobody has a plan to reach them.", vis: <TerrainPanel /> },
  { title: "The app reads street photos to find utility poles", text: "Fiber is much cheaper to hang on poles than to bury. A pole detector looks at real street photos and marks the poles it finds.", vis: <DetectionDemo /> },
  { title: "This is what fiber on those poles would look like", text: "Drag the handle to compare the street today with fiber on its poles. Roads with poles cost about half as much to build on.", vis: <FiberDemo /> },
  { title: "Hills and trees decide where wireless works", text: "A tower only reaches a home if nothing blocks the path. The app checks the ground and tree height along every path.", vis: <WirelessPanel /> },
  { title: "Then it picks the cheapest way to reach everyone", text: "A routing algorithm chooses the lowest-cost set of roads, and prices every home along the way.", vis: <NetworkPanel /> },
  { title: "And it does this for every county in the country", text: "Plans are being built for all 3,235 counties. Families check an address, and counties and co-ops get the numbers they need to ask for funding.", vis: <UsMap height={420} /> },
];
const LENGTH = 11000;

export default function Tour() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((v) => (v + 1) % SCENES.length), LENGTH);
    return () => clearTimeout(t);
  }, [i, playing]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => (v + 1) % SCENES.length);
      if (e.key === "ArrowLeft") setI((v) => (v + SCENES.length - 1) % SCENES.length);
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const s = SCENES[i];
  return (
    <main style={{ background: "#0a1424", color: "#fff", minHeight: "calc(100dvh - 61px)" }}>
      <div className="wrap" style={{ maxWidth: 1240, padding: "36px 20px 40px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {SCENES.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Scene ${k + 1}`} style={{ flex: 1, height: 6, border: 0, padding: 0, cursor: "pointer", background: "#2a3d5c", position: "relative" }}>
              <i key={`${k}-${i}-${playing}`} style={{ position: "absolute", inset: 0, background: "#4d8dff", transform: k < i ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left", animation: k === i && playing ? `fill ${LENGTH}ms linear forwards` : undefined, ...(k === i && !playing ? { transform: "scaleX(0.4)" } : {}) }} />
            </button>
          ))}
        </div>
        <div className="tour-grid">
          <div>
            <p className="label" style={{ color: "#8fa3c4" }}>{i + 1} of {SCENES.length}</p>
            <h1 style={{ fontSize: 40, marginTop: 10, color: "#fff" }}>{s.title}</h1>
            <p className="lede" style={{ color: "#c6d1e4" }}>{s.text}</p>
            <div className="row" style={{ marginTop: 28 }}>
              <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
              <button className="btn line" style={{ background: "transparent", color: "#fff", borderColor: "#fff" }} onClick={() => setI((v) => (v + 1) % SCENES.length)}>Next</button>
              <Link className="btn line" style={{ background: "transparent", color: "#fff", borderColor: "#fff" }} href="/home">Check my address</Link>
            </div>
          </div>
          <div style={{ minWidth: 0 }} key={i}>{s.vis}</div>
        </div>
      </div>
    </main>
  );
}
