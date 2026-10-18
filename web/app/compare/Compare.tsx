"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useIndex } from "@/lib/useIndex";
import { dollars, money, num, totalCost } from "@/lib/cost";

type Key = "perHome" | "unserved" | "homesPerM";

export default function Compare() {
  const idx = useIndex();
  const [by, setBy] = useState<Key>("perHome");
  const [st, setSt] = useState("");
  const [shown, setShown] = useState(25);

  const rows = useMemo(() => {
    if (!idx) return [];
    const r = idx.filter((c) => !st || c.state === st).map((c) => {
      const cost = totalCost({ homesAll: c.homes, unserved: c.unserved, fiberHomes: c.fiberHomes, wirelessHomes: c.wirelessHomes, unreached: 0, towers: c.towers, aerialFt: c.aerialFt, buriedFt: c.buriedFt, dropFt: c.dropFt }, c.assumptions);
      const fiberFt = c.aerialFt + c.buriedFt;
      return { c, cost, homesPerM: cost.total ? cost.homes / (cost.total / 1e6) : 0, aerialPct: fiberFt ? (c.aerialFt / fiberFt) * 100 : 0, wirelessPct: cost.homes ? (c.wirelessHomes / cost.homes) * 100 : 0 };
    });
    r.sort((a, b) => (by === "perHome" ? a.cost.perHome - b.cost.perHome : by === "unserved" ? b.c.unserved - a.c.unserved : b.homesPerM - a.homesPerM));
    return r;
  }, [idx, by, st]);
  const states = useMemo(() => [...new Set((idx ?? []).map((c) => c.state))].sort(), [idx]);

  const best = rows.length ? [...rows].sort((a, b) => b.homesPerM - a.homesPerM)[0] : null;
  const maxPer = Math.max(...rows.map((r) => r.cost.perHome), 1);

  return (
    <main className="wrap page">
      <h1>Compare counties</h1>
      <p className="lede">Which places connect the most homes for the money? Every county was planned the same way with the same prices, so the numbers can be compared.</p>

      {!idx && <p style={{ marginTop: 24 }}>Loading</p>}
      {best && rows.length > 1 && (
        <div className="box blue" style={{ marginTop: 28 }}>
          <p className="label">Most homes for the money</p>
          <p className="big sm" style={{ marginTop: 8 }}>{best.c.name}, {best.c.state}</p>
          <p style={{ marginTop: 6 }}>{num(best.homesPerM)} homes connected for every $1 million</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <Scatter rows={rows.map((r) => ({ name: `${r.c.name}, ${r.c.state}`, x: r.cost.perHome, y: r.c.unserved, slug: r.c.slug }))} />
          <div className="row noprint" style={{ marginTop: 28 }}>
            <label><span className="label">State </span><select className="field" style={{ minHeight: 36, fontSize: 14, width: "auto", display: "inline-block" }} value={st} onChange={(e) => { setSt(e.target.value); setShown(25); }}><option value="">All ({idx?.length})</option>{states.map((x) => <option key={x}>{x}</option>)}</select></label>
            <span className="label">Sort by</span>
            {([["perHome", "Cost per home"], ["unserved", "Homes without service"], ["homesPerM", "Homes per $1M"]] as [Key, string][]).map(([k, l]) => (
              <button key={k} className="btn sm line" aria-pressed={by === k} onClick={() => setBy(k)}>{l}</button>
            ))}
          </div>
          <table>
            <thead><tr><th>County</th><th className="r">Without service</th><th className="r">Reached by plan</th><th className="r">Total cost</th><th>Cost per home</th><th className="r">Fiber on poles</th><th className="r">Wireless</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, shown).map(({ c, cost, aerialPct, wirelessPct }) => (
                <tr key={c.slug}>
                  <th>{c.name}, {c.state}</th>
                  <td className="r">{num(c.unserved)}</td>
                  <td className="r">{num(cost.homes)}</td>
                  <td className="r">{money(cost.total)}</td>
                  <td style={{ minWidth: 150 }}>{dollars(cost.perHome)}<div className="bar"><i style={{ width: `${(cost.perHome / maxPer) * 100}%` }} /></div></td>
                  <td className="r">{aerialPct.toFixed(0)}%</td>
                  <td className="r">{wirelessPct.toFixed(0)}%</td>
                  <td><Link href={`/county?county=${c.slug}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown && <p style={{ marginTop: 8 }}><button className="btn sm line" onClick={() => setShown((n) => n + 50)}>Show more ({rows.length - shown} left)</button></p>}
          <p className="small">“Fiber on poles” is the share of fiber that runs on roads with poles. Counties with more poles cost less to connect. Service status is an estimate until FCC data is loaded.</p>
        </>
      )}
    </main>
  );
}

// Every planned county as a dot: cost to connect a home across, homes without service up
function Scatter({ rows }: { rows: { name: string; x: number; y: number; slug: string }[] }) {
  const pts = rows.filter((r) => r.x > 0 && r.y > 0);
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  const xmax = xs[Math.floor(xs.length * 0.98)] * 1.05;
  const ymax = Math.log10(Math.max(...pts.map((p) => p.y)) * 1.2), ymin = Math.log10(Math.max(1, Math.min(...pts.map((p) => p.y)) * 0.8));
  const W = 900, H = 340, L = 56, B = 40, T = 12, R = 14;
  const X = (v: number) => L + (Math.min(v, xmax) / xmax) * (W - L - R);
  const Y = (v: number) => T + (1 - (Math.log10(v) - ymin) / (ymax - ymin || 1)) * (H - T - B);
  const med = xs[Math.floor(xs.length / 2)];
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ margin: "0 0 8px" }}>Every county at a glance</h2>
      <p className="small" style={{ marginBottom: 8 }}>Each dot is a county. Dots further right cost more to connect a home. Dots higher up have more homes without service. The line shows the middle county.</p>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cost per home against homes without service for each county">
        {[0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={T + (1 - f) * (H - T - B)} y2={T + (1 - f) * (H - T - B)} stroke="#e4e0d6" /></g>)}
        {[1000, 3000, 6000, 10000, 15000].filter((v) => v < xmax).map((v) => <text key={v} x={X(v)} y={H - 18} textAnchor="middle">{"$" + v.toLocaleString("en-US")}</text>)}
        {[10, 100, 1000, 10000, 100000].filter((v) => Math.log10(v) >= ymin && Math.log10(v) <= ymax).map((v) => <text key={v} x={L - 8} y={Y(v) + 4} textAnchor="end">{v.toLocaleString("en-US")}</text>)}
        <line x1={X(med)} x2={X(med)} y1={T} y2={H - B} stroke="#d64533" strokeWidth="2" strokeDasharray="5 4" />
        {pts.map((p) => <a key={p.slug} href={`/county?county=${p.slug}`}><circle cx={X(p.x)} cy={Y(p.y)} r="4" fill="#1b5fd1" fillOpacity="0.55"><title>{p.name}: {Math.round(p.x).toLocaleString("en-US")} dollars a home, {p.y.toLocaleString("en-US")} homes without service</title></circle></a>)}
        <text x={W - R} y={H - 2} textAnchor="end">Cost to connect one home</text>
        <text x={4} y={T + 8}>Homes without service</text>
      </svg>
    </div>
  );
}
