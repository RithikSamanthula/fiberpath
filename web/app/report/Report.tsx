"use client";
import { useEffect, useMemo, useState } from "react";
import { dollars, money, num, totalCost } from "@/lib/cost";
import { CountySelect, useCountyParam } from "@/lib/useCounty";
import { FT, distM } from "@/lib/geo";
import { DATA_BASE } from "@/lib/data";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Report() {
  const { data, error, index, slug, setSlug } = useCountyParam();
  const [demand, setDemand] = useState<{ total: number; minCell: number } | null>(null);
  const [cv, setCv] = useState<{ trainImages: number; valImages: number; precision: number; recall: number; map50: number } | null>(null);
  useEffect(() => { fetch(`${DATA_BASE}/cv-metrics.json`).then((r) => (r.ok ? r.json() : null)).then(setCv).catch(() => {}); }, []);
  useEffect(() => { if (slug) fetch(`/api/demand?county=${slug}`).then((r) => r.json()).then(setDemand).catch(() => {}); }, [slug]);

  const mix = useMemo(() => {
    if (!data) return null;
    return [1, 2, 3].map((t) => {
      const hs = data.homes.filter((h) => h.tech === t);
      return { tech: t, n: hs.length, avg: hs.length ? hs.reduce((s, h) => s + h.cost, 0) / hs.length : 0 };
    });
  }, [data]);

  if (error) return <main className="wrap page"><p>{error}</p></main>;
  if (!data || !mix) return <main className="wrap page"><p>Loading the report</p></main>;

  const { meta } = data;
  const t = meta.totals;
  const a = meta.assumptions;
  const c = totalCost(t, a);
  const b = meta.benchmark;
  const names = ["", "Fiber on poles", "Buried fiber", "Fixed wireless"];
  const colors = ["", "var(--blue)", "var(--amber)", "var(--green)"];

  const geojson = () => JSON.stringify({
    type: "FeatureCollection",
    features: data.plan.map((e) => ({
      type: "Feature",
      properties: { type: e[4] === 1 ? "aerial" : "buried", feet: Math.round(distM(e[0], e[1], e[2], e[3]) * FT), homes_downstream: e[6] },
      geometry: { type: "LineString", coordinates: [[e[0], e[1]], [e[2], e[3]]] },
    })),
  });
  const csv = () => "lat,lon,status,plan,estimated_cost\n" + data.homes.map((h) => `${h.lat},${h.lon},${["served", "underserved", "unserved"][h.status]},${["none", "aerial_fiber", "buried_fiber", "fixed_wireless"][h.tech]},${h.cost}`).join("\n");

  return (
    <main className="wrap page">
      <div className="row noprint" style={{ justifyContent: "space-between" }}>
        <div style={{ minWidth: 260 }}><CountySelect index={index} slug={slug} onChange={setSlug} /></div>
        <div className="row">
          <button className="btn sm line" onClick={() => download(`${meta.slug}-routes.geojson`, geojson(), "application/geo+json")}>Routes (GeoJSON)</button>
          <button className="btn sm line" onClick={() => download(`${meta.slug}-homes.csv`, csv(), "text/csv")}>Homes (CSV)</button>
          <a className="btn sm line" href={`/flyer?county=${meta.slug}`}>Flyer</a>
          <button className="btn sm" onClick={() => window.print()}>Export PDF</button>
        </div>
      </div>
      <p className="label" style={{ marginTop: 28 }}>Grant report</p>
      <h1 style={{ marginTop: 8 }}>{meta.name}, {meta.state}: buildout plan</h1>
      <p className="lede">The cheapest network to connect {num(c.homes)} homes without good internet. Made {meta.generated} from public data.</p>

      <div className="stats" style={{ marginTop: 28 }}>
        <div className="stat"><div className="big">{num(c.homes)}</div><span className="label">Homes reached</span></div>
        <div className="stat"><div className="big">{dollars(c.perHome)}</div><span className="label">Cost per home</span></div>
        <div className="stat"><div className="big">{money(c.total)}</div><span className="label">Total cost</span></div>
        <div className="stat"><div className="big">{num(t.unserved)}</div><span className="label">Homes without service</span></div>
        <div className="stat"><div className="big">{num(Math.round(t.unserved * 2.5))}</div><span className="label">People, about</span></div>
      </div>

      <h2>Technology mix</h2>
      <div className="seg" aria-hidden="true">{mix.map((r) => <i key={r.tech} style={{ width: `${c.homes ? (r.n / c.homes) * 100 : 0}%`, background: colors[r.tech] }} />)}</div>
      <table>
        <thead><tr><th>Technology</th><th className="r">Homes</th><th className="r">Share</th><th className="r">Average cost per home</th></tr></thead>
        <tbody>
          {mix.map((r) => (
            <tr key={r.tech}><td><span style={{ display: "inline-block", width: 12, height: 12, background: colors[r.tech], marginRight: 8 }} />{names[r.tech]}</td><td className="r">{num(r.n)}</td><td className="r">{c.homes ? Math.round((r.n / c.homes) * 100) : 0}%</td><td className="r">{r.n ? dollars(r.avg) : "—"}</td></tr>
          ))}
        </tbody>
      </table>
      {t.unreached > 0 && <p className="small">{num(t.unreached)} further homes could not be linked to the hub by the mapped road network and are not counted above.</p>}

      <h2>Cost per home</h2>
      <p className="small">Each bar counts homes at that price. The long tail on the right is a few homes that are very costly to reach.</p>
      <Histogram homes={data.homes} colors={colors} />

      <h2>What more poles would save</h2>
      <p className="small">Fiber on poles costs about half as much per foot as buried fiber. The line shows how the average cost per home changes as more of the route can use poles.</p>
      <PoleSavings t={t} a={a} />

      <h2>Cost breakdown</h2>
      <table>
        <thead><tr><th>Item</th><th className="r">Quantity</th><th className="r">Unit cost</th><th className="r">Cost</th></tr></thead>
        <tbody>
          <tr><td>Fiber on poles</td><td className="r">{num(t.aerialFt / 5280)} mi</td><td className="r">{dollars(a.aerialPerFt)} / ft</td><td className="r">{money(t.aerialFt * a.aerialPerFt)}</td></tr>
          <tr><td>Buried fiber</td><td className="r">{num(t.buriedFt / 5280)} mi</td><td className="r">{dollars(a.buriedPerFt)} / ft</td><td className="r">{money(t.buriedFt * a.buriedPerFt)}</td></tr>
          <tr><td>Fiber connection to each home</td><td className="r">{num(t.fiberHomes)} homes</td><td className="r">{dollars(a.dropBase)} + {dollars(a.dropPerFt)} / ft</td><td className="r">{money(t.fiberHomes * a.dropBase + t.dropFt * a.dropPerFt)}</td></tr>
          <tr><td>Wireless towers</td><td className="r">{num(t.towers)}</td><td className="r">{dollars(a.towerEach)}</td><td className="r">{money(t.towers * a.towerEach)}</td></tr>
          <tr><td>Wireless antennas for homes</td><td className="r">{num(t.wirelessHomes)}</td><td className="r">{dollars(a.wirelessCpe)}</td><td className="r">{money(t.wirelessHomes * a.wirelessCpe)}</td></tr>
          <tr><th>Total</th><td /><td /><th className="r">{money(c.total)}</th></tr>
        </tbody>
      </table>
      <p className="small">The unit costs are prices you can change on the County plans screen. Routes and technology choices were planned at the prices shown.</p>

      <h2>Homes asking for service</h2>
      <p>
        {demand ? <><strong>{num(demand.total)}</strong> {demand.total === 1 ? "home has" : "homes have"} asked for service in {meta.name}.</> : "Demand counts are not available right now."}
        {" "}Counts only appear on the map where five or more homes in the same area have asked. No address is ever shown.</p>

      {b && (
        <>
          <h2>Compared with a real project</h2>
          <table>
            <thead><tr><th /><th className="r">Homes</th><th className="r">Total</th><th className="r">Per home</th></tr></thead>
            <tbody>
              <tr><td>FiberPath estimate</td><td className="r">{num(c.homes)}</td><td className="r">{money(c.total)}</td><td className="r">{dollars(c.perHome)}</td></tr>
              <tr><td>{b.name} project</td><td className="r">{num(b.homes)}</td><td className="r">{money(b.total)}</td><td className="r">{dollars(b.per_home)}</td></tr>
            </tbody>
          </table>
          <p>
            Our per-home estimate is {Math.abs(((c.perHome - b.per_home) / b.per_home) * 100).toFixed(0)}% {c.perHome >= b.per_home ? "above" : "below"} the published figure. This is a sanity check, not proof: the {b.name} project covers different homes and an unknown technology mix, and its total includes {money(b.grant)} in BEAD funding.
          </p>
        </>
      )}

      <h2>What has been checked</h2>
      <table>
        <thead><tr><th>Check</th><th>Method</th><th>Result</th></tr></thead>
        <tbody>
          {b && <tr><td>Cost per home</td><td>Plan vs. the {b.name} project</td><td>{dollars(c.perHome)} vs. {dollars(b.per_home)}</td></tr>}
          <tr><td>Pole finding</td><td>FiberPath's own detector on {cv ? num(cv.valImages) : "held-out"} street photos from streets it never trained on; {num(meta.poleCount)} poles mapped in this county</td><td>{cv ? `Precision ${Math.round(cv.precision * 100)}%, recall ${Math.round(cv.recall * 100)}%` : "Not yet measured"}</td></tr>
          <tr><td>Home counts</td><td>Building counts vs. FCC counts per hexagon</td><td>{meta.coverageSource === "fcc" ? "FCC data loaded" : "Needs FCC data"}</td></tr>
          <tr><td>Line of sight</td><td>20 homes checked by hand against terrain profiles</td><td>Not yet measured</td></tr>
        </tbody>
      </table>

      <h2>Data and method</h2>
      <p>
        Homes: Microsoft building footprints, 60 to 600 m². Roads: OpenStreetMap. Poles: {meta.poleSource}. Terrain: USGS 3DEP via AWS terrain tiles. Trees: Meta and WRI canopy height. Coverage: {meta.coverageSource === "fcc" ? "FCC National Broadband Map" : "modeled estimate (FCC data not loaded)"}. Network: Kou–Markowsky–Berman Steiner tree approximation over the road graph, provably within 2× of the cheapest possible network. Full credits are on the How it works screen.
      </p>
    </main>
  );
}

function Histogram({ homes, colors }: { homes: { tech: number; cost: number }[]; colors: string[] }) {
  const hs = homes.filter((h) => h.tech > 0).map((h) => ({ t: h.tech, c: h.cost })).sort((a, b) => a.c - b.c);
  if (!hs.length) return null;
  const cap = hs[Math.floor(hs.length * 0.97)].c || 1;
  const step = Math.max(250, Math.ceil(cap / 24 / 250) * 250);
  const nb = Math.ceil(cap / step) + 1;
  const bins = Array.from({ length: nb }, () => [0, 0, 0, 0]);
  for (const h of hs) bins[Math.min(nb - 1, Math.floor(h.c / step))][h.t]++;
  const max = Math.max(...bins.map((b) => b[1] + b[2] + b[3]), 1);
  const W = 900, H = 260, L = 44, B = 34, T = 10;
  const bw = (W - L - 10) / nb;
  const palette = ["", "#1b5fd1", "#f2a900", "#1c8c4e"];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Number of homes at each cost to connect" style={{ marginTop: 10 }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line x1={L} x2={W - 10} y1={T + (1 - f) * (H - T - B)} y2={T + (1 - f) * (H - T - B)} stroke="#d6d1c4" /><text x={L - 6} y={T + (1 - f) * (H - T - B) + 4} textAnchor="end">{Math.round(max * f)}</text></g>
      ))}
      {bins.map((b, i) => {
        let y = H - B;
        return (
          <g key={i}>
            {[1, 2, 3].map((t) => { const h = (b[t] / max) * (H - T - B); y -= h; return h > 0 ? <rect key={t} x={L + i * bw + 1} y={y} width={bw - 2} height={h} fill={palette[t]} /> : null; })}
            {i % 3 === 0 && <text x={L + i * bw} y={H - 12}>{"$" + (i * step >= 1000 ? (i * step) / 1000 + "k" : i * step)}</text>}
          </g>
        );
      })}
      <text x={W - 10} y={H - 12} textAnchor="end">{"$" + cap.toLocaleString("en-US") + "+"}</text>
    </svg>
  );
}

function PoleSavings({ t, a }: { t: { aerialFt: number; buriedFt: number; fiberHomes: number; dropFt: number; towers: number; wirelessHomes: number }; a: { aerialPerFt: number; buriedPerFt: number; dropBase: number; dropPerFt: number; towerEach: number; wirelessCpe: number } }) {
  const ft = t.aerialFt + t.buriedFt;
  const homes = t.fiberHomes + t.wirelessHomes;
  const cost = (p: number) => (ft * (p * a.aerialPerFt + (1 - p) * a.buriedPerFt) + t.fiberHomes * a.dropBase + t.dropFt * a.dropPerFt + t.towers * a.towerEach + t.wirelessHomes * a.wirelessCpe) / Math.max(homes, 1);
  const now = ft ? t.aerialFt / ft : 0;
  const W = 900, H = 240, L = 64, B = 34, T = 14;
  const lo = cost(1), hi = cost(0);
  const x = (p: number) => L + p * (W - L - 16);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const save = cost(now) - cost(Math.min(1, now + 0.1));
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cost per home by share of route on poles" style={{ marginTop: 10 }}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - 16} y1={y(lo + (hi - lo) * f)} y2={y(lo + (hi - lo) * f)} stroke="#d6d1c4" /><text x={L - 8} y={y(lo + (hi - lo) * f) + 4} textAnchor="end">{"$" + Math.round(lo + (hi - lo) * f).toLocaleString("en-US")}</text></g>)}
        <polyline points={[0, 0.25, 0.5, 0.75, 1].map((p) => `${x(p)},${y(cost(p))}`).join(" ")} fill="none" stroke="#1b5fd1" strokeWidth="3" />
        <line x1={x(now)} x2={x(now)} y1={T} y2={H - B} stroke="#d64533" strokeWidth="2" strokeDasharray="5 4" />
        <circle cx={x(now)} cy={y(cost(now))} r="6" fill="#d64533" />
        <text x={Math.min(x(now) + 10, W - 120)} y={T + 14} style={{ fontWeight: 700 }}>Today: {Math.round(now * 100)}% on poles</text>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => <text key={p} x={x(p)} y={H - 12} textAnchor={p === 0 ? "start" : p === 1 ? "end" : "middle"}>{Math.round(p * 100)}% on poles</text>)}
      </svg>
      <p style={{ marginTop: 8 }}>Every extra 10% of the route on poles would cut the average cost by about <strong>{"$" + Math.round(save).toLocaleString("en-US")}</strong> per home.</p>
    </>
  );
}
