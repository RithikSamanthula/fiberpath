"use client";
import Link from "next/link";
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
