"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IndexItem, loadIndex } from "@/lib/data";
import { dollars, money, num, totalCost } from "@/lib/cost";

type Key = "perHome" | "unserved" | "homesPerM";

export default function Compare() {
  const [idx, setIdx] = useState<IndexItem[] | null>(null);
  const [by, setBy] = useState<Key>("perHome");
  const [st, setSt] = useState("");
  const [shown, setShown] = useState(25);
  useEffect(() => { loadIndex().then(setIdx); }, []);

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
      <p className="lede">Where does each dollar connect the most homes? Every county here was planned with the same method and the same cost assumptions, so the numbers line up.</p>

      {!idx && <p style={{ marginTop: 24 }}>Loading…</p>}
      {best && rows.length > 1 && (
        <div className="box blue" style={{ marginTop: 28 }}>
          <p className="label">Most homes per dollar</p>
          <p className="big sm" style={{ marginTop: 8 }}>{best.c.name}, {best.c.state}</p>
          <p style={{ marginTop: 6 }}>{num(best.homesPerM)} homes connected for every $1 million spent.</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
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
          <p className="small">“Fiber on poles” is the share of planned fiber length on roads with poles. A county with more poles is cheaper to connect. Status is modeled until FCC data is loaded for the county.</p>
        </>
      )}
    </main>
  );
}
