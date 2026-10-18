"use client";
import Link from "next/link";
import { useIndex } from "@/lib/useIndex";
import { dollars, num, totalCost } from "@/lib/cost";

export default function PlannedList() {
  const all = useIndex();
  const idx = all && [...all].sort((a, b) => (b.plannedAt ?? "").localeCompare(a.plannedAt ?? "")).slice(0, 8);
  if (!idx) return <p className="small">Loading…</p>;
  return (
    <div className="list" style={{ marginTop: 16 }}>
      {idx.map((c) => {
        const cost = totalCost({ ...c, homesAll: c.homes, unserved: c.unserved, fiberHomes: c.fiberHomes, wirelessHomes: c.wirelessHomes, unreached: 0, towers: c.towers, aerialFt: c.aerialFt, buriedFt: c.buriedFt, dropFt: c.dropFt }, c.assumptions);
        return (
          <div className="item" key={c.slug}>
            <div><strong>{c.name}, {c.state}</strong><br /><span className="small">{num(c.unserved)} unserved homes · about {dollars(cost.perHome)} per home</span></div>
            <div className="row"><Link className="btn sm line" href={`/report?county=${c.slug}`}>Grant report</Link><Link className="btn sm" href={`/county?county=${c.slug}`}>View plan</Link></div>
          </div>
        );
      })}
    </div>
  );
}
