"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DATA_BASE } from "@/lib/data";
import { num } from "@/lib/cost";
import { useIndex } from "@/lib/useIndex";
import { useSaved } from "@/lib/saved";
import Icon from "./Icons";

export function LiveStats() {
  const idx = useIndex();
  const fcc = idx?.filter((c) => c.coverageSource === "fcc") ?? [];
  const cards: [string, string][] = [
    [idx ? num(idx.length) : "-", "Counties planned"],
    [idx ? num(fcc.length) : "-", "Using real FCC data"],
    [idx ? num(idx.reduce((s, c) => s + c.homes, 0)) : "-", "Homes mapped"],
    [fcc.length ? num(fcc.reduce((s, c) => s + c.unserved, 0)) : "-", "Without good internet, FCC counties"],
  ];
  return (
    <div className="ah-stats" aria-live="polite">
      {cards.map(([v, l]) => <div className="stat-card" key={l}><div className="v">{v}</div><div className="l">{l}</div></div>)}
    </div>
  );
}

const COLOR = ["var(--green)", "var(--amber)", "var(--red)"];
export function SavedPlaces() {
  const { list, remove } = useSaved();
  return (
    <div>
      <h2>Your places</h2>
      {!list.length ? (
        <div className="box soft"><p style={{ display: "flex", gap: 10, alignItems: "center" }}><Icon name="bookmark" /> Addresses you save show up here, so you can come back to them.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {list.map((s) => (
            <div key={s.address} className="place">
              <span className="dot" style={{ background: s.status === undefined ? "#9aa5b8" : COLOR[s.status] }} />
              <Link href={`/home?address=${encodeURIComponent(s.address)}`} style={{ flex: 1, color: "inherit", textDecoration: "none", minWidth: 0 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.address}</b>
                <span className="small">{s.county}{s.status !== undefined ? ` · ${["Served", "Underserved", "Unserved"][s.status]}` : ""}</span>
              </Link>
              <button className="btn sm line" onClick={() => remove(s.address)} aria-label={`Remove ${s.address}`}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The detector's measured results, read from the file the training script writes
export function DetectorFacts() {
  const [m, setM] = useState<any>(null);
  useEffect(() => { fetch(`${DATA_BASE}/cv-metrics.json`).then((r) => (r.ok ? r.json() : null)).then(setM).catch(() => {}); }, []);
  if (!m?.photo) return null;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const near = m.recallByDistance?.near;
  return (
    <div>
      <div className="ah-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="stat-card"><div className="v">{pct(m.photo.accuracy)}</div><div className="l">Of street photos judged right (pole or no pole)</div></div>
        {near && <div className="stat-card"><div className="v">{pct(near.recall)}</div><div className="l">Of nearby poles found</div></div>}
        <div className="stat-card"><div className="v">{num(m.valImages)}</div><div className="l">Test photos from streets it never saw</div></div>
      </div>
      <p className="small" style={{ marginTop: 8, color: "#4a5870" }}>Measured against Mapillary&apos;s own labels, so it shows agreement with them. Far-away poles are harder: the detector finds about {pct(m.recallByDistance?.far?.recall ?? 0)} of those.</p>
    </div>
  );
}
