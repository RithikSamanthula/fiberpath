"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UsMap from "@/components/UsMap";
import { dollars, money, num, totalCost } from "@/lib/cost";
import type { Assumptions, IndexItem } from "@/lib/data";

const PEOPLE = 2.5; // national average people per household
const LABELS: Record<keyof Assumptions, string> = {
  aerialPerFt: "Fiber on poles, $ per foot", buriedPerFt: "Buried fiber, $ per foot", dropBase: "Connection to a home, $", dropPerFt: "Connection, $ per foot",
  towerEach: "Wireless tower, $ each", wirelessCpe: "Antenna for a home, $",
};

export function costOf(c: IndexItem, prices: Assumptions | null) {
  return totalCost({ homesAll: c.homes, unserved: c.unserved, fiberHomes: c.fiberHomes, wirelessHomes: c.wirelessHomes, unreached: 0, towers: c.towers, aerialFt: c.aerialFt, buriedFt: c.buriedFt, dropFt: c.dropFt }, prices ?? c.assumptions);
}

function usePledges(items: IndexItem[]) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(items.slice(0, 25).map((c) => fetch(`/api/demand?county=${c.slug}`).then((r) => r.json()).then((j) => j.total as number).catch(() => 0))).then((a) => live && setN(a.reduce((s, x) => s + x, 0)));
    return () => { live = false; };
  }, [items]);
  return n;
}

function Tiles({ tiles }: { tiles: [string, string][] }) {
  return <div className="stats">{tiles.map(([b, l]) => <div className="stat" key={l}><div className="big sm" style={{ whiteSpace: "nowrap" }}>{b}</div><span className="label">{l}</span></div>)}</div>;
}

function Bars({ rows, fmt, color = "#1b5fd1" }: { rows: { name: string; v: number; href?: string }[]; fmt: (v: number) => string; color?: string }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 190px) 1fr 90px", gap: 12, alignItems: "center", padding: "5px 0" }}>
          {r.href ? <Link href={r.href}>{r.name}</Link> : <span>{r.name}</span>}
          <div className="bar" style={{ height: 16, marginTop: 0 }}><i style={{ width: `${(r.v / max) * 100}%`, background: color }} /></div>
          <b style={{ textAlign: "right" }}>{fmt(r.v)}</b>
        </div>
      ))}
    </div>
  );
}

// ---- electric co-ops and small providers -----------------------------------------------------
export function CoopDashboard({ items, prices, setPrices }: { items: IndexItem[]; prices: Assumptions | null; setPrices: (p: Assumptions | null) => void }) {
  const base = items[0]?.assumptions;
  const eff = prices ?? base;
  const rows = items.map((c) => ({ c, cost: costOf(c, eff) }));
  const tot = rows.reduce((s, r) => ({ homes: s.homes + r.cost.homes, cost: s.cost + r.cost.total, un: s.un + r.c.unserved, wl: s.wl + r.c.wirelessHomes, fb: s.fb + r.c.fiberHomes }), { homes: 0, cost: 0, un: 0, wl: 0, fb: 0 });
  const pledges = usePledges(items);
  return (
    <div className="dash">
      <Tiles tiles={[[num(tot.un), "Homes without service"], [num(tot.homes), "Homes in the plan"], [money(tot.cost), "Total cost"], [tot.homes ? dollars(tot.cost / tot.homes) : "-", "Cost per home"], [pledges === null ? "-" : num(pledges), "Homes that asked for service"]]} />
      <div>
        <h2 style={{ margin: "0 0 10px" }}>Cost by county</h2>
        <Bars rows={rows.sort((a, b) => b.cost.total - a.cost.total).map((r) => ({ name: r.c.name, v: r.cost.total, href: `/county?county=${r.c.slug}` }))} fmt={money} />
      </div>
      <div>
        <h2 style={{ margin: "0 0 6px" }}>How homes would be connected</h2>
        <div className="seg" style={{ height: 22 }}><i style={{ width: `${tot.homes ? (tot.fb / tot.homes) * 100 : 0}%`, background: "var(--amber)" }} /><i style={{ width: `${tot.homes ? (tot.wl / tot.homes) * 100 : 0}%`, background: "var(--green)" }} /></div>
        <p className="small" style={{ marginTop: 6 }}>{num(tot.fb)} homes by fiber and {num(tot.wl)} by fixed wireless</p>
      </div>
      <div>
        <h2 style={{ margin: "0 0 6px" }}>Your prices</h2>
        <p className="small" style={{ marginBottom: 10 }}>Use your own costs and every number above updates. They are saved in this browser.</p>
        {eff && (
          <div className="assume" style={{ maxWidth: 520 }}>
            {(Object.keys(LABELS) as (keyof Assumptions)[]).map((k) => (
              <label key={k} style={{ display: "contents" }}><span>{LABELS[k]}</span><input inputMode="decimal" value={eff[k]} onChange={(e) => setPrices({ ...eff, [k]: Math.max(0, Number(e.target.value) || 0) })} /></label>
            ))}
          </div>
        )}
        {prices && <button className="btn sm line" style={{ marginTop: 10 }} onClick={() => setPrices(null)}>Back to the standard prices</button>}
      </div>
      <div>
        <h2 style={{ margin: "0 0 10px" }}>Documents</h2>
        <div className="list">
          {rows.map(({ c }) => (
            <div className="item" key={c.geoid}><strong>{c.name}, {c.state}</strong>
              <div className="row"><Link className="btn sm line" href={`/report?county=${c.slug}`}>Grant report</Link><Link className="btn sm line" href={`/flyer?county=${c.slug}`}>Flyer</Link><Link className="btn sm" href={`/county?county=${c.slug}`}>Open plan</Link></div></div>
          ))}
        </div>
        <p className="small" style={{ marginTop: 8 }}>Each grant report has downloads for the routes (GeoJSON) and the homes (CSV).</p>
      </div>
    </div>
  );
}

// ---- state and county broadband offices -------------------------------------------------------
export function OfficeDashboard({ items, prices }: { items: IndexItem[]; prices: Assumptions | null }) {
  const [funds, setFunds] = useState(25);
  const rows = items.map((c) => ({ c, cost: costOf(c, prices) })).filter((r) => r.cost.total > 0);
  // fund the counties where each dollar connects the most homes, until the money runs out
  const plan = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.cost.homes / b.cost.total - a.cost.homes / a.cost.total);
    let left = funds * 1e6, homes = 0, spent = 0;
    const out = sorted.map((r) => { const ok = r.cost.total <= left; if (ok) { left -= r.cost.total; homes += r.cost.homes; spent += r.cost.total; } return { ...r, ok }; });
    return { out, left, homes, spent };
  }, [rows, funds]);
  const totalHomes = rows.reduce((s, r) => s + r.cost.homes, 0), totalCostAll = rows.reduce((s, r) => s + r.cost.total, 0);
  return (
    <div className="dash">
      <Tiles tiles={[[num(items.reduce((s, c) => s + c.unserved, 0)), "Homes without service"], [num(rows.length), "Counties"], [money(totalCostAll), "Cost to connect all"], [totalHomes ? dollars(totalCostAll / totalHomes) : "-", "Average cost per home"]]} />
      <div>
        <h2 style={{ margin: "0 0 6px" }}>Where would the money go?</h2>
        <p className="small" style={{ marginBottom: 10 }}>Enter the funding you have. Counties are funded in order of homes connected per dollar, and a county is only funded in full.</p>
        <label className="row"><span className="label">Funding in millions</span><input className="field" style={{ width: 140, minHeight: 44, fontSize: 18 }} inputMode="decimal" value={funds} onChange={(e) => setFunds(Math.max(0, Number(e.target.value) || 0))} /></label>
        <Tiles tiles={[[num(plan.homes), "Homes connected"], [plan.out.filter((r) => r.ok).length + " of " + plan.out.length, "Counties funded"], [money(plan.left), "Left over"]]} />
        <table>
          <thead><tr><th>County</th><th className="r">Homes</th><th className="r">Cost</th><th className="r">Per home</th><th>Funded</th></tr></thead>
          <tbody>
            {plan.out.slice(0, 40).map((r) => (
              <tr key={r.c.geoid} style={{ opacity: r.ok ? 1 : 0.55 }}>
                <td><Link href={`/county?county=${r.c.slug}`}>{r.c.name}</Link></td><td className="r">{num(r.cost.homes)}</td><td className="r">{money(r.cost.total)}</td><td className="r">{dollars(r.cost.perHome)}</td>
                <td>{r.ok ? <span className="chip green">Yes</span> : <span className="chip gray">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.out.length > 40 && <p className="small">Showing the first 40 of {plan.out.length}</p>}
      </div>
      <div>
        <h2 style={{ margin: "0 0 10px" }}>Counties with the most homes without service</h2>
        <Bars rows={[...items].sort((a, b) => b.unserved - a.unserved).slice(0, 8).map((c) => ({ name: c.name, v: c.unserved, href: `/county?county=${c.slug}` }))} fmt={num} color="#d64533" />
      </div>
      <div className="row"><Link className="btn" href="/compare">Compare all counties</Link></div>
    </div>
  );
}

// ---- congressional offices --------------------------------------------------------------------
export function CongressDashboard({ items, name, prices }: { items: IndexItem[]; name: string; prices: Assumptions | null }) {
  const rows = items.map((c) => ({ c, cost: costOf(c, prices) }));
  const un = rows.reduce((s, r) => s + r.c.unserved, 0), cost = rows.reduce((s, r) => s + r.cost.total, 0), homes = rows.reduce((s, r) => s + r.cost.homes, 0);
  const pledges = usePledges(items);
  const cheap = [...rows].filter((r) => r.cost.homes > 50).sort((a, b) => a.cost.perHome - b.cost.perHome).slice(0, 3);
  const need = [...rows].sort((a, b) => b.c.unserved - a.c.unserved).slice(0, 3);
  const hi = useMemo(() => new Set(items.map((c) => c.geoid)), [items]);
  return (
    <div className="dash">
      <Tiles tiles={[[num(un), "Homes without good internet"], [num(Math.round(un * PEOPLE)), "People, about"], [money(cost), "Cost to close the gap"], [homes ? dollars(cost / homes) : "-", "Cost per home"], [pledges === null ? "-" : num(pledges), "Homes asking for service"]]} />
      <UsMap height={380} highlight={hi} />
      <div className="box soft">
        <p className="label">Briefing</p>
        <p style={{ marginTop: 8, fontSize: 18, maxWidth: "70ch" }}>
          {name || "This area"} covers {rows.length} {rows.length === 1 ? "county" : "counties"}. About {num(un)} homes ({num(Math.round(un * PEOPLE))} people) do not have good internet. Connecting all of them would cost about {money(cost)}, or {homes ? dollars(cost / homes) : "-"} a home.
          {cheap.length ? ` The cheapest places to start are ${cheap.map((r) => `${r.c.name} (${dollars(r.cost.perHome)} a home)`).join(", ")}.` : ""}
          {need.length ? ` The most homes without service are in ${need.map((r) => `${r.c.name} (${num(r.c.unserved)})`).join(", ")}.` : ""}
        </p>
        <p className="small" style={{ marginTop: 8 }}>Costs are planning estimates. Service status is an estimate until FCC coverage data is loaded.</p>
      </div>
      <div className="row noprint"><button className="btn" onClick={() => window.print()}>Print the briefing</button><Link className="btn line" href="/compare">Compare counties</Link></div>
      <div>
        <h2 style={{ margin: "0 0 10px" }}>Homes without service, by county</h2>
        <Bars rows={[...rows].sort((a, b) => b.c.unserved - a.c.unserved).slice(0, 12).map((r) => ({ name: r.c.name, v: r.c.unserved, href: `/county?county=${r.c.slug}` }))} fmt={num} color="#d64533" />
      </div>
    </div>
  );
}
