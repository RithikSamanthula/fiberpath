"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UsMap from "@/components/UsMap";
import { dollars, money, num, totalCost } from "@/lib/cost";
import type { Assumptions, IndexItem } from "@/lib/data";

const PEOPLE = 2.5; // national average people per household
const BENCH = 3540; // Blue Ridge Mountain EMC, dollars per home, the real project this tool is checked against
const LABELS: Record<keyof Assumptions, string> = {
  aerialPerFt: "Fiber on poles, $ per foot", buriedPerFt: "Buried fiber, $ per foot", dropBase: "Connection to a home, $", dropPerFt: "Connection, $ per foot",
  towerEach: "Wireless tower, $ each", wirelessCpe: "Antenna for a home, $",
};
const TABS = ["Overview", "Counties", "Funding", "Prices", "Documents"] as const;

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
  return <div className="ah-stats">{tiles.map(([b, l]) => <div className="stat-card" key={l}><div className="v">{b}</div><div className="l">{l}</div></div>)}</div>;
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <div className="stat-card" style={{ padding: 20 }}><p style={{ fontWeight: 800, fontSize: 17 }}>{title}</p>{note && <p className="small" style={{ color: "#4a5870", marginBottom: 8 }}>{note}</p>}<div style={{ marginTop: 10 }}>{children}</div></div>;
}

function Bars({ rows, fmt, color = "#1b5fd1", mark }: { rows: { name: string; v: number; href?: string }[]; fmt: (v: number) => string; color?: string; mark?: { v: number; label: string } }) {
  const max = Math.max(...rows.map((r) => r.v), mark?.v ?? 0, 1);
  return (
    <div style={{ position: "relative" }}>
      {rows.map((r) => (
        <div key={r.name} className="row3" style={{ "--c1": "170px", "--c3": "84px", padding: "5px 0" } as React.CSSProperties}>
          {r.href ? <Link href={r.href} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Link> : <span>{r.name}</span>}
          <div className="bar" style={{ height: 16, marginTop: 0, borderRadius: 4, position: "relative" }}>
            <i style={{ width: `${(r.v / max) * 100}%`, background: color, borderRadius: 4 }} />
            {mark && <span title={mark.label} style={{ position: "absolute", left: `${(mark.v / max) * 100}%`, top: -3, bottom: -3, width: 2, background: "#0f1b2d" }} />}
          </div>
          <b style={{ textAlign: "right" }}>{fmt(r.v)}</b>
        </div>
      ))}
      {mark && <p className="small" style={{ marginTop: 4 }}>Dark line: {mark.label}</p>}
    </div>
  );
}

function Donut({ parts }: { parts: { v: number; color: string; label: string }[] }) {
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
  let a = -Math.PI / 2;
  const R = 52, r = 32;
  return (
    <div className="row" style={{ gap: 20, flexWrap: "nowrap" }}>
      <svg width="130" height="130" viewBox="-60 -60 120 120" role="img" aria-label="Share of homes by way of connecting">
        {parts.map((p) => {
          const b = a + (p.v / tot) * Math.PI * 2 - 0.0001, big = b - a > Math.PI ? 1 : 0;
          const d = `M${R * Math.cos(a)} ${R * Math.sin(a)}A${R} ${R} 0 ${big} 1 ${R * Math.cos(b)} ${R * Math.sin(b)}L${r * Math.cos(b)} ${r * Math.sin(b)}A${r} ${r} 0 ${big} 0 ${r * Math.cos(a)} ${r * Math.sin(a)}Z`;
          a = b + 0.0001;
          return p.v > 0 ? <path key={p.label} d={d} fill={p.color} /> : null;
        })}
      </svg>
      <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
        {parts.map((p) => <div key={p.label}><span style={{ display: "inline-block", width: 12, height: 12, background: p.color, borderRadius: 3, marginRight: 8 }} /><b>{Math.round((p.v / tot) * 100)}%</b> {p.label} <span className="small">({num(p.v)})</span></div>)}
      </div>
    </div>
  );
}

function Histogram({ values, fmt }: { values: number[]; fmt: (v: number) => string }) {
  if (values.length < 3) return <p className="small">Needs at least three counties.</p>;
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[0], hi = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const bins = 12, w = (hi - lo) / bins || 1, h = new Array(bins).fill(0);
  for (const v of values) h[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)))]++;
  const m = Math.max(...h);
  return (
    <svg viewBox="0 0 360 130" className="chart" style={{ border: 0 }} role="img" aria-label="How many counties fall in each cost per home range">
      {h.map((n, i) => <rect key={i} x={i * 30 + 3} y={100 - (n / m) * 92} width={24} height={(n / m) * 92} rx={3} fill="#1b5fd1" />)}
      <line x1="0" y1="100" x2="360" y2="100" stroke="#0f1b2d" />
      <text x="2" y="118">{fmt(lo)}</text><text x="358" y="118" textAnchor="end">{fmt(hi)}+</text>
    </svg>
  );
}

const Badge = ({ fcc }: { fcc: boolean }) => <span className={`chip ${fcc ? "green" : "gray"}`}>{fcc ? "FCC data" : "Estimate"}</span>;

// One workspace for everyone: a co-op, a county office or a congressional office all see the same things.
export default function Workspace({ items, name, prices, setPrices }: { items: IndexItem[]; name: string; prices: Assumptions | null; setPrices: (p: Assumptions | null) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const nFcc = items.filter((c) => c.coverageSource === "fcc").length;
  const [withEst, setWithEst] = useState(nFcc === 0);
  const used = useMemo(() => (withEst ? items : items.filter((c) => c.coverageSource === "fcc")), [items, withEst]);
  const eff = prices ?? items[0]?.assumptions;
  const rows = useMemo(() => used.map((c) => ({ c, cost: costOf(c, prices) })), [used, prices]);
  const un = rows.reduce((s, r) => s + r.c.unserved, 0), cost = rows.reduce((s, r) => s + r.cost.total, 0), homes = rows.reduce((s, r) => s + r.cost.homes, 0);
  const fb = rows.reduce((s, r) => s + r.c.fiberHomes, 0), wl = rows.reduce((s, r) => s + r.c.wirelessHomes, 0);
  const allHomes = rows.reduce((s, r) => s + r.c.homes, 0);
  const pledges = usePledges(used);
  const hi = useMemo(() => new Set(used.map((c) => c.geoid)), [used]);
  const perHome = homes ? cost / homes : 0;
  const cheap = [...rows].filter((r) => r.cost.homes > 50).sort((a, b) => a.cost.perHome - b.cost.perHome).slice(0, 3);
  const need = [...rows].sort((a, b) => b.c.unserved - a.c.unserved).slice(0, 3);
  const states = useMemo(() => { const m = new Map<string, number>(); for (const r of rows) m.set(r.c.state, (m.get(r.c.state) ?? 0) + r.c.unserved); return [...m].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v).slice(0, 8); }, [rows]);

  const [funds, setFunds] = useState(25);
  const plan = useMemo(() => {
    const sorted = [...rows].filter((r) => r.cost.total > 0).sort((a, b) => b.cost.homes / b.cost.total - a.cost.homes / a.cost.total);
    let left = funds * 1e6, h = 0;
    const out = sorted.map((r) => { const ok = r.cost.total <= left; if (ok) { left -= r.cost.total; h += r.cost.homes; } return { ...r, ok }; });
    return { out, left, homes: h };
  }, [rows, funds]);

  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "unserved", dir: -1 });
  const [q, setQ] = useState("");
  const table = useMemo(() => {
    const val = (r: (typeof rows)[number]) => ({ name: r.c.name, unserved: r.c.unserved, share: r.c.homes ? r.c.unserved / r.c.homes : 0, cost: r.cost.total, per: r.cost.perHome, fiber: r.c.fiberHomes }) as Record<string, number | string>;
    return rows.filter((r) => `${r.c.name} ${r.c.state}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => {
      const x = val(a)[sort.k], y = val(b)[sort.k];
      return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
    });
  }, [rows, sort, q]);
  const th = (k: string, label: string, r = true) => <th className={r ? "r" : ""} style={{ cursor: "pointer" }} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>{label}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</th>;

  return (
    <div className="dash">
      <div className="ah-card" style={{ padding: 24, borderRadius: 14, gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="label" style={{ color: "#aebad0" }}>{items.length} {items.length === 1 ? "county" : "counties"}</p>
            <h2 style={{ margin: "4px 0 0", color: "#fff", fontSize: 28 }}>{name || "Your workspace"}</h2>
          </div>
          <div style={{ minWidth: 240 }}>
            <p className="small" style={{ color: "#c6d0e2" }}>{nFcc} of {items.length} on real FCC data</p>
            <div className="seg" style={{ height: 10, borderRadius: 5, overflow: "hidden", background: "#243653" }}><i style={{ width: `${items.length ? (nFcc / items.length) * 100 : 0}%`, background: "var(--green)" }} /></div>
            {nFcc > 0 && nFcc < items.length && (
              <button className="btn sm" style={{ marginTop: 8, background: withEst ? "transparent" : "#fff", color: withEst ? "#fff" : "var(--ink)", borderColor: "#fff" }} aria-pressed={withEst} onClick={() => setWithEst(!withEst)}>
                {withEst ? "Counting estimated counties too" : "Counting FCC counties only"}
              </button>
            )}
          </div>
        </div>
        <div className="tabs noprint" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>

      {!rows.length && <div className="box soft"><p>None of these counties has been re-planned with FCC data yet. The cloud run is working through them now. <button className="btn sm" onClick={() => setWithEst(true)}>Show the estimates meanwhile</button></p></div>}

      {rows.length > 0 && tab === "Overview" && (
        <section style={{ display: "grid", gap: 16 }}>
          <Tiles tiles={[[num(un), "Homes without good internet"], [allHomes ? `${(un / allHomes * 100).toFixed(1)}%` : "-", "Share of all homes"], [money(cost), "Cost to connect them"], [homes ? dollars(perHome) : "-", "Cost per home"], [num(Math.round(un * PEOPLE)), "People, about"], [pledges === null ? "-" : num(pledges), "Homes asking for service"]]} />
          <div className="box soft">
            <p style={{ fontSize: 18, maxWidth: "75ch" }}>
              {name || "This area"} covers {rows.length} {rows.length === 1 ? "county" : "counties"}. About {num(un)} homes ({num(Math.round(un * PEOPLE))} people) do not have good internet. Connecting all of them would cost about {money(cost)}, or {homes ? dollars(perHome) : "-"} a home.
              {cheap.length ? ` The cheapest places to start are ${cheap.map((r) => `${r.c.name} (${dollars(r.cost.perHome)} a home)`).join(", ")}.` : ""}
              {need.length ? ` The most homes without service are in ${need.map((r) => `${r.c.name} (${num(r.c.unserved)})`).join(", ")}.` : ""}
            </p>
            <p className="small" style={{ marginTop: 8 }}>Costs are planning estimates from public data. Service status comes from the FCC National Broadband Map{withEst && nFcc < items.length ? "; counties marked Estimate are still waiting for it" : ""}.</p>
            <p className="noprint" style={{ marginTop: 12 }}><button className="btn sm" onClick={() => window.print()}>Print this summary</button></p>
          </div>
          <div style={{ borderRadius: 14, overflow: "hidden" }}><UsMap height={340} highlight={hi} /></div>
          <div className="ah-row">
            <Card title="How homes would be connected" note="Share of the homes in the plan"><Donut parts={[{ v: fb, color: "#f2a900", label: "Fiber" }, { v: wl, color: "#1c8c4e", label: "Fixed wireless" }, { v: Math.max(0, homes - fb - wl), color: "#8a8f99", label: "Other" }]} /></Card>
            <Card title="Cost per home, county by county" note={`How many counties fall in each price range. The Blue Ridge EMC project cost ${dollars(BENCH)} a home.`}><Histogram values={rows.filter((r) => r.cost.homes > 20).map((r) => r.cost.perHome)} fmt={dollars} /></Card>
          </div>
          <div className="ah-row">
            <Card title="Most homes without service"><Bars rows={[...rows].sort((a, b) => b.c.unserved - a.c.unserved).slice(0, 7).map((r) => ({ name: r.c.name, v: r.c.unserved, href: `/county?county=${r.c.slug}` }))} fmt={num} color="#d64533" /></Card>
            <Card title="Cheapest to connect, per home"><Bars rows={[...rows].filter((r) => r.cost.homes > 50).sort((a, b) => a.cost.perHome - b.cost.perHome).slice(0, 7).map((r) => ({ name: r.c.name, v: r.cost.perHome, href: `/county?county=${r.c.slug}` }))} fmt={dollars} color="#1c8c4e" mark={{ v: BENCH, label: `Blue Ridge EMC, ${dollars(BENCH)} a home` }} /></Card>
          </div>
          {states.length > 1 && <Card title="By state" note="Homes without good internet"><Bars rows={states} fmt={num} color="#1b5fd1" /></Card>}
        </section>
      )}

      {tab === "Counties" && (
        <section style={{ display: "grid", gap: 12 }}>
          <input className="field" style={{ minHeight: 46, fontSize: 16, maxWidth: 380 }} placeholder="Search these counties" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search these counties" />
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>{th("name", "County", false)}<th>Data</th>{th("unserved", "Without service")}{th("share", "Share of homes")}{th("cost", "Cost")}{th("per", "Per home")}{th("fiber", "By fiber")}<th /></tr></thead>
              <tbody>
                {table.slice(0, 200).map(({ c, cost: k }) => (
                  <tr key={c.geoid}>
                    <td><Link href={`/county?county=${c.slug}`}>{c.name}, {c.state}</Link></td>
                    <td><Badge fcc={c.coverageSource === "fcc"} /></td>
                    <td className="r">{num(c.unserved)}</td>
                    <td className="r">{c.homes ? `${((c.unserved / c.homes) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="r">{money(k.total)}</td>
                    <td className="r">{k.homes ? dollars(k.perHome) : "-"}</td>
                    <td className="r">{k.homes ? `${Math.round((c.fiberHomes / k.homes) * 100)}%` : "-"}</td>
                    <td><Link className="btn sm line" href={`/county?county=${c.slug}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.length > 200 && <p className="small">Showing the first 200 of {table.length}</p>}
        </section>
      )}

      {rows.length > 0 && tab === "Funding" && (
        <section style={{ display: "grid", gap: 14 }}>
          <p className="small">Enter the funding you have. Counties are funded in order of homes connected per dollar, and a county is only funded in full.</p>
          <label className="row"><span className="label">Funding in millions</span><input className="field" style={{ width: 140, minHeight: 44, fontSize: 18 }} inputMode="decimal" value={funds} onChange={(e) => setFunds(Math.max(0, Number(e.target.value) || 0))} /></label>
          <input type="range" min={1} max={Math.max(100, Math.ceil(cost / 1e6))} value={Math.min(funds, Math.max(100, Math.ceil(cost / 1e6)))} onChange={(e) => setFunds(Number(e.target.value))} aria-label="Funding in millions" style={{ width: "100%" }} />
          <Tiles tiles={[[num(plan.homes), "Homes connected"], [plan.out.filter((r) => r.ok).length + " of " + plan.out.length, "Counties funded"], [money(plan.left), "Left over"], [homes ? `${Math.round((plan.homes / homes) * 100)}%` : "-", "Of every home that needs it"]]} />
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>County</th><th className="r">Homes</th><th className="r">Cost</th><th className="r">Per home</th><th>Funded</th></tr></thead>
              <tbody>
                {plan.out.slice(0, 40).map((r) => (
                  <tr key={r.c.geoid} style={{ opacity: r.ok ? 1 : 0.55 }}>
                    <td><Link href={`/county?county=${r.c.slug}`}>{r.c.name}, {r.c.state}</Link></td><td className="r">{num(r.cost.homes)}</td><td className="r">{money(r.cost.total)}</td><td className="r">{dollars(r.cost.perHome)}</td>
                    <td>{r.ok ? <span className="chip green">Yes</span> : <span className="chip gray">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.out.length > 40 && <p className="small">Showing the first 40 of {plan.out.length}</p>}
        </section>
      )}

      {tab === "Prices" && (
        <section>
          <p style={{ fontWeight: 700 }}>Your prices</p>
          <p className="small" style={{ margin: "4px 0 10px" }}>Use your own costs and every number in this workspace updates. They are saved in this browser.</p>
          {eff && (
            <div className="assume" style={{ maxWidth: 520 }}>
              {(Object.keys(LABELS) as (keyof Assumptions)[]).map((k) => (
                <label key={k} style={{ display: "contents" }}><span>{LABELS[k]}</span><input inputMode="decimal" value={eff[k]} onChange={(e) => setPrices({ ...eff, [k]: Math.max(0, Number(e.target.value) || 0) })} /></label>
              ))}
            </div>
          )}
          {prices && <button className="btn sm line" style={{ marginTop: 10 }} onClick={() => setPrices(null)}>Back to the standard prices</button>}
          <p className="small" style={{ marginTop: 16 }}>Total with these prices: <b>{money(cost)}</b>, or <b>{homes ? dollars(perHome) : "-"}</b> a home.</p>
        </section>
      )}

      {tab === "Documents" && (
        <section>
          <div className="list">
            {items.slice(0, 40).map((c) => (
              <div className="item" key={c.geoid}><strong>{c.name}, {c.state}</strong>
                <div className="row"><Link className="btn sm line" href={`/report?county=${c.slug}`}>Grant report</Link><Link className="btn sm line" href={`/flyer?county=${c.slug}`}>Flyer</Link><Link className="btn sm" href={`/county?county=${c.slug}`}>Open plan</Link></div></div>
            ))}
          </div>
          {items.length > 40 && <p className="small" style={{ marginTop: 8 }}>Showing the first 40 of {items.length}. Each grant report has downloads for the routes (GeoJSON) and the homes (CSV).</p>}
        </section>
      )}
    </div>
  );
}
