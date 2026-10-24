"use client";
import { useEffect, useState } from "react";
import PhotoDetect from "./PhotoDetect";
import type { Box } from "@/lib/iou";
import { DATA_BASE } from "@/lib/data";

type Ex = { img: string; place: string; boxes: Box[]; candidates: Box[] };
type Metrics = { trainImages: number; valImages: number; precision: number; recall: number; map50: number; perClass?: Record<string, { precision: number; recall: number }> };

const STEPS = [
  { stage: "photo" as const, ms: 1500, t: "1  Photo", d: "A street photo goes in" },
  { stage: "candidates" as const, ms: 2600, t: "2  Guesses", d: "The model marks every place a pole might be" },
  { stage: "final" as const, ms: 4200, t: "3  Result", d: "Overlapping guesses merge and street lights are dropped" },
];

// The pole detector working on real photos, on a loop: photo, proposals, decision.
export default function DetectionDemo() {
  const [ex, setEx] = useState<Ex[] | null>(null);
  const [m, setM] = useState<Metrics | null>(null);
  const [i, setI] = useState(0);
  const [s, setS] = useState(0);

  useEffect(() => {
    fetch("/cv-demo/manifest.json").then((r) => (r.ok ? r.json() : null)).then(setEx).catch(() => {});
    fetch(`${DATA_BASE}/cv-metrics.json`).then((r) => (r.ok ? r.json() : null)).then(setM).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ex?.length) return;
    const t = setTimeout(() => {
      if (s === STEPS.length - 1) { setS(0); setI((v) => (v + 1) % ex.length); } else setS(s + 1);
    }, STEPS[s].ms);
    return () => clearTimeout(t);
  }, [ex, s, i]);

  if (!ex?.length) return null;
  const cur = ex[i];
  const util = cur.boxes.filter((b) => (b.cls ?? 0) === 0).length;
  const other = cur.boxes.length - util;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.9fr) minmax(240px, 1fr)", gap: 20, alignItems: "stretch" }} className="demo-grid">
      <div>
        <PhotoDetect key={i} src={cur.img} boxes={cur.boxes} candidates={cur.candidates} stage={STEPS[s].stage} animate ratio={0.5625} />
        <div style={{ display: "flex", marginTop: 10 }}>
          {STEPS.map((st, k) => (
            <div key={k} style={{ flex: 1, padding: "8px 12px", borderTop: `4px solid ${k === s ? "#4d8dff" : "#333333"}`, color: k === s ? "#fff" : "#7f93b5" }}>
              <div style={{ fontWeight: 800 }}>{st.t}</div>
              <div className="small">{st.d}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <Tile big={String(util)} label="Utility poles in this photo" color="#4d8dff" />
        <Tile big={String(other)} label="Street lights and other poles, left out" color="#ffffff" />
        {m && <Tile big={`${Math.round(m.precision * 100)}%`} label={`Of the poles it marks, how many are real (tested on ${m.valImages} new photos)`} color="#38c47c" />}
        {m && <Tile big={`${Math.round(m.recall * 100)}%`} label="Of the labeled poles, how many it finds" color="#ffb81c" />}
        <p className="small" style={{ color: "#9a9a9a" }}>{cur.place}. Photos from Mapillary contributors</p>
      </div>
    </div>
  );
}

function Tile({ big, label, color }: { big: string; label: string; color: string }) {
  return (
    <div style={{ background: "#080808", borderLeft: `6px solid ${color}`, padding: "12px 16px", color: "#fff" }}>
      <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{big}</div>
      <div className="small" style={{ color: "#cfcfcf", marginTop: 4 }}>{label}</div>
    </div>
  );
}
