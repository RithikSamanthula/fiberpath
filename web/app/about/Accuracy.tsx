"use client";
import { useEffect, useState } from "react";
import { DATA_BASE } from "@/lib/data";

type M = { valImages: number; trainImages: number; precision: number; recall: number; photo: { accuracy: number; precision: number; recall: number }; recallByDistance: Record<string, { labels: number; recall: number }> };

const pct = (v: number) => `${Math.round(v * 100)}%`;

// The detector's measured results, shown as bars instead of a paragraph
export default function Accuracy() {
  const [m, setM] = useState<M | null>(null);
  useEffect(() => { fetch(`${DATA_BASE}/cv-metrics.json`).then((r) => (r.ok ? r.json() : null)).then(setM).catch(() => {}); }, []);
  if (!m) return <p className="small">Loading</p>;
  const bars: [string, number, string][] = [
    ["Does a photo have a utility pole? Right answer", m.photo.accuracy, "#1b5fd1"],
    ["Poles it marks that are real", m.precision, "#1c8c4e"],
    ["Labeled poles it finds", m.recall, "#f2a900"],
  ];
  const d = Object.entries(m.recallByDistance);
  return (
    <div style={{ display: "grid", gap: 28 }} className="acc">
      <div>
        {bars.map(([l, v, c]) => (
          <div key={l} style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span>{l}</span><b>{pct(v)}</b></div>
            <div className="bar" style={{ height: 18 }}><i style={{ width: pct(v), background: c }} /></div>
          </div>
        ))}
        <p className="small">Tested on {m.valImages} photos from streets the model was not trained on. These labels come from Mapillary, so these three numbers show agreement with Mapillary.</p>
      </div>
      <div>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>Poles found by distance</p>
        <svg viewBox="0 0 400 170" style={{ width: "100%", maxWidth: 520 }} role="img" aria-label="Share of labeled poles found, by how far away the pole is">
          {d.map(([k, v], i) => {
            const h = v.recall * 120;
            return (
              <g key={k}>
                <rect x={20 + i * 95} y={140 - h} width="70" height={h} fill="#1b5fd1" />
                <text x={55 + i * 95} y={134 - h} textAnchor="middle" style={{ font: "700 13px sans-serif" }}>{pct(v.recall)}</text>
                <text x={55 + i * 95} y={160} textAnchor="middle" style={{ font: "13px sans-serif" }}>{k}</text>
              </g>
            );
          })}
        </svg>
        <p className="small">Poles close to the camera are found most of the time. Poles far down the road are much harder.</p>
      </div>
    </div>
  );
}
