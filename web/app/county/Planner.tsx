"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { Layers } from "@/components/MapView";
import Terrain3D from "@/components/Terrain3D";
import BudgetLens from "@/components/BudgetLens";
import Scanner from "@/components/cv/Scanner";
import { RANGE_NOTE, costRange, dollars, edgeCosts, money, num, range, totalCost } from "@/lib/cost";
import { contours } from "@/lib/contours";
import { viewshed } from "@/lib/geo";
import type { Assumptions, Home } from "@/lib/data";
import { CountySelect, useCountyParam } from "@/lib/useCounty";

const LABELS: Record<keyof Assumptions, string> = {
  aerialPerFt: "Fiber on poles, $ per ft",
  buriedPerFt: "Buried fiber, $ per ft",
  dropBase: "Connection to home, $ each",
  dropPerFt: "Connection, $ per ft",
  towerEach: "Wireless tower, $ each",
  wirelessCpe: "Wireless receiver, $ each",
};
const LAYER: Record<string, string> = { roads: "Roads", plan: "Plan", homes: "Homes", towers: "Towers", wireless: "Wireless links", poles: "Poles" };
const TECH = ["Not in plan", "Fiber on poles", "Buried fiber", "Fixed wireless"];

export default function Planner() {
  const { data, error, index, slug, setSlug } = useCountyParam();
  const q = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState<Layers>({ roads: true, plan: true, homes: true, towers: true, poles: false, wireless: true });
  const [sel, setSel] = useState<Home | null>(null);
  const [a, setA] = useState<Assumptions | null>(null);
  const [demand, setDemand] = useState<{ total: number; cells: { lat: number; lon: number; count: number }[]; minCell: number } | null>(null);
  const [showDemand, setShowDemand] = useState(true);
  const raf = useRef(0);
  const [terrain, setTerrain] = useState(true);
  const [sat, setSat] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [budgetMask, setBudgetMask] = useState<Uint8Array | null>(null);
  const [tool, setTool] = useState(false);
  const [ghost, setGhost] = useState<{ lon: number; lat: number } | null>(null);
  const cont = useMemo(() => (data?.hasGrids ? contours(data) : null), [data]);
  const vs = useMemo(() => (data && ghost ? viewshed(data, ghost.lon, ghost.lat, data.homes) : null), [data, ghost]);

  useEffect(() => { if (data && !a) setA(data.meta.assumptions); }, [data, a]);
  // links like /county?county=towns-ga&home=123&view=3d open straight to a home in 3D
  useEffect(() => {
    if (!data) return;
    const h = q.get("home");
    if (h != null && data.homes[Number(h)]) { setSel(data.homes[Number(h)]); if (q.get("view") === "3d") { setView3d(true); setProgress(1); } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  useEffect(() => { if (slug) fetch(`/api/demand?county=${slug}`).then((r) => r.json()).then(setDemand).catch(() => {}); }, [slug]);
  useEffect(() => { setProgress(0); setSel(null); setA(null); setGhost(null); setTool(false); }, [slug]);

  const eff = a ?? data?.meta.assumptions;
  const cost = useMemo(() => (data && eff ? totalCost(data.meta.totals, eff) : null), [data, eff]);
  const rg = useMemo(() => (data && eff ? costRange(data.meta.totals, eff) : null), [data, eff]);
  const cum = useMemo(() => {
    if (!data || !eff) return [0];
    const c = edgeCosts(data.plan, eff);
    const out = [0];
    for (const x of c) out.push(out[out.length - 1] + x);
    return out;
  }, [data, eff]);

  function play() {
    if (!data) return;
    cancelAnimationFrame(raf.current);
    setPlaying(true);
    setProgress(0);
    const t0 = performance.now();
    const dur = 5000;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(step);
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const shown = useMemo(() => {
    if (!data || !cost) return { homes: 0, total: 0 };
    if (progress >= 1) return { homes: cost.homes, total: cost.total };
    const n = Math.floor(progress * data.plan.length);
    const depth = n > 0 ? data.plan[n - 1][5] : -1;
    let homes = 0;
    for (const h of data.homes) if (h.tech !== 0 && h.tech !== 3 && h.depth <= depth) homes++;
    const frac = cum[n] / (cum[cum.length - 1] || 1);
    return { homes, total: (cost.total - cost.wireless) * frac };
  }, [data, cost, progress, cum]);

  if (error) return <main className="wrap page"><p>{error}</p></main>;
  if (!data || !cost || !eff) return <main className="wrap page"><p>Loading the county</p></main>;

  const t = data.meta.totals;
  const perHome = shown.homes ? shown.total / shown.homes : 0;
  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const unreachedNow = progress === 0 ? t.unserved : progress >= 1 ? t.unreached : Math.max(0, t.unserved - shown.homes);

  return (
    <div className="app">
      <div className="stage">
        <div className="topbar" aria-live="polite">
          <div className="stat" style={{ minWidth: progress >= 1 && rg ? 210 : undefined }}><div className="big" style={progress >= 1 && rg ? { fontSize: 22, paddingTop: 8 } : undefined}>{progress === 0 ? "—" : progress >= 1 && rg ? range(rg.lo.perHome, rg.hi.perHome, dollars) : dollars(perHome)}</div><span className="label">Cost per home</span></div>
          <div className="stat"><div className="big">{num(progress === 0 ? 0 : shown.homes)}</div><span className="label">Homes connected</span></div>
          <div className="stat" style={{ minWidth: progress >= 1 && rg ? 190 : undefined }}><div className="big" style={progress >= 1 && rg ? { fontSize: 22, paddingTop: 8 } : undefined}>{progress === 0 ? "—" : progress >= 1 && rg ? range(rg.lo.total, rg.hi.total, money) : money(shown.total)}</div><span className="label">Total cost</span></div>
          <div className="stat"><div className="big">{num(unreachedNow)}</div><span className="label">Homes left</span></div>
        </div>
        {view3d ? <Terrain3D data={data} progress={progress} onPick={setSel} focus={sel ? { lon: sel.lon, lat: sel.lat, key: sel.i } : null} /> : (
        <MapView
          data={data}
          layers={layers}
          progress={progress}
          selected={sel}
          onPick={setSel}
          contours={terrain ? cont : null}
          satellite={sat}
          reach={budgetMask ?? vs?.res ?? null}
          pulse={progress >= 1}
          ghost={ghost}
          onMapClick={tool ? (lo, la) => setGhost({ lon: lo, lat: la }) : null}
          hexes={showDemand ? demand?.cells : undefined}
        />
        )}
        <div className="legend noprint">
          <div><span className="sw" /> Fiber on poles</div>
          <div><span className="sw amber" /> Buried fiber</div>
          <div><span className="sw dot" /> Fixed wireless</div>
          <div><span className="sw sq" /> Tower</div>
          <div><span className="sw pt" /> Home without service</div>
          <div><span className="sw ring" /> Home connected</div>
        </div>
      </div>

      <aside className="side">
        <CountySelect index={index} slug={slug} onChange={setSlug} />
        <p className="small" style={{ marginTop: 8 }}>{num(t.homesAll)} homes, {num(t.unserved)} without good internet</p>
        {rg && <details className="small" style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Why the cost is a range</summary><p style={{ marginTop: 6 }}>{RANGE_NOTE} Here: {range(rg.lo.perHome, rg.hi.perHome, dollars)} a home.</p></details>}
        <div className="box soft" style={{ marginTop: 12 }}>
          <p className="label">How to read this</p>
          <p className="small" style={{ marginTop: 6 }}>
            Each red dot is a home without good internet. Press Plan network to watch the cheapest roads connect them. Blue lines are fiber on poles, amber lines are buried fiber and green squares are towers.<strong>Plan network</strong> and watch the cheapest set of roads connect them. Blue lines are fiber on poles, amber lines are buried fiber, and green squares are wireless towers.
          </p>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn line" aria-pressed={view3d} onClick={() => setView3d((v) => !v)}>{view3d ? "Back to map" : "See in 3D"}</button>
          <button className="btn" onClick={play} disabled={playing}>{progress === 0 ? "Plan network" : playing ? "Planning" : "Replay"}</button>
          {progress > 0 && !playing && <button className="btn line" onClick={() => setProgress(0)}>Before</button>}
        </div>
        <p className="small" style={{ marginTop: 10 }}>
          {num(t.fiberHomes)} homes by fiber, {num(t.wirelessHomes)} by wireless from {t.towers} towers
          {t.unreached ? `, ${num(t.unreached)} are not on a connected road` : ""}.
        </p>

        <h3>Show on the map</h3>
        <div className="toggles">
          {(["roads", "plan", "homes", "towers", "wireless", "poles"] as const).map((k) => (
            <button key={k} className="btn sm line" aria-pressed={layers[k]} onClick={() => toggle(k)}>{LAYER[k]}</button>
          ))}
          <button className="btn sm line" aria-pressed={showDemand} onClick={() => setShowDemand((v) => !v)}>Demand</button>
          <button className="btn sm line" aria-pressed={terrain} onClick={() => setTerrain((v) => !v)}>Terrain</button>
          <button className="btn sm line" aria-pressed={sat} onClick={() => setSat((v) => !v)}>Aerial photos</button>
        </div>
        {demand && (
          <p className="small" style={{ marginTop: 8 }}>
            {num(demand.total)} {demand.total === 1 ? "home has" : "homes have"} raised a hand. Circles appear where {demand.minCell}+ homes in one area have.
          </p>
        )}

        <BudgetLens data={data} onMask={setBudgetMask} />

        <h3>Try a tower</h3>
        <p className="small">Drop a tower anywhere and see which homes can reach it past the hills and trees.</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" aria-pressed={tool} onClick={() => setTool((v) => !v)}>{tool ? "Click the map" : "Drop a tower"}</button>
          {ghost && <button className="btn sm line" onClick={() => { setGhost(null); setTool(false); }}>Clear</button>}
        </div>
        {vs && (
          <div className="box soft" style={{ marginTop: 10 }}>
            <p className="big sm">{num(vs.seen)}</p>
            <p className="small">of {num(vs.total)} homes without service within 7 km can reach this tower</p>
            <p className="small" style={{ marginTop: 6 }}>
              {vs.seen > 0
                ? `Serving ${num(Math.min(vs.seen, 250))} homes (a tower serves about 250), that is ${dollars((eff.towerEach) / Math.min(vs.seen, 250) + eff.wirelessCpe)} a home`
                : "No home can reach a tower here. Try a higher spot"}
            </p>
            <p className="small" style={{ marginTop: 6 }}>Green dots can reach it. Dim red dots are in range but blocked.</p>
          </div>
        )}

        {sel && (
          <>
            <h3>Selected home</h3>
            <table>
              <tbody>
                <tr><th>Status</th><td>{["Served", "Underserved", "Unserved"][sel.status]}</td></tr>
                <tr><th>Plan</th><td>{TECH[sel.tech]}</td></tr>
                {sel.tech > 0 && <tr><th>Cost</th><td>{dollars(sel.cost)}</td></tr>}
                {(sel.tech === 1 || sel.tech === 2) && <tr><th>Neighbors on route</th><td>{sel.neighbors}</td></tr>}
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}><Scanner lat={sel.lat} lon={sel.lon} ratio={0.62} /></div>
            {sel.tech > 0 && <p style={{ marginTop: 10, display: "grid", gap: 4 }}><Link href={`/street?lat=${sel.lat}&lon=${sel.lon}`}>Walk this street in 3D</Link><Link href={`/sight?county=${slug}&home=${sel.i}`}>Line-of-sight picture</Link></p>}
          </>
        )}

        <h3>Cost assumptions</h3>
        <div className="assume">
          {(Object.keys(LABELS) as (keyof Assumptions)[]).map((k) => (
            <label key={k} style={{ display: "contents" }}>
              <span>{LABELS[k]}</span>
              <input
                inputMode="decimal"
                value={eff[k]}
                onChange={(e) => setA({ ...eff, [k]: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          ))}
        </div>
        <p className="small" style={{ marginTop: 10 }}>
          Routes and technology choices were planned at the default values. Changing a value reprices the same plan.
        </p>
        <button className="btn line" style={{ marginTop: 10 }} onClick={() => setA(data.meta.assumptions)}>Reset assumptions</button>

        <div className="row" style={{ marginTop: 20 }}><Link className="btn sm" href={`/report?county=${slug}`}>Grant report</Link><Link className="btn sm line" href={`/flyer?county=${slug}`}>Flyer</Link><Link className="btn sm line" href={`/poles?county=${slug}`}>Poles</Link><Link className="btn sm line" href={`/sight?county=${slug}`}>Line of sight</Link></div>
      </aside>
    </div>
  );
}
