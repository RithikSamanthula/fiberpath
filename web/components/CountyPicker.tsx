"use client";
import { useEffect, useMemo, useState } from "react";
import UsMap from "@/components/UsMap";
import { costRange, dollars, num, range, totalCost } from "@/lib/cost";
import type { IndexItem } from "@/lib/data";
import { useIndex } from "@/lib/useIndex";

const RECENT = "fiberpath-recent-counties-v1";
const FIPS: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR" };
const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico" };

const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT) || "[]"); } catch { return []; } };
export const rememberCounty = (slug: string) => { try { localStorage.setItem(RECENT, JSON.stringify([slug, ...readRecent().filter((s) => s !== slug)].slice(0, 8))); } catch {} };

const tot = (c: IndexItem) => ({ homesAll: c.homes, unserved: c.unserved, fiberHomes: c.fiberHomes, wirelessHomes: c.wirelessHomes, unreached: 0, towers: c.towers, aerialFt: c.aerialFt, buriedFt: c.buriedFt, dropFt: c.dropFt });
const perHomeRange = (c: IndexItem) => { const r = costRange(tot(c), c.assumptions); return r.hi.homes ? range(r.lo.perHome, r.hi.perHome, dollars) : "-"; };
const perHome = (c: IndexItem) => { const t = totalCost({ homesAll: c.homes, unserved: c.unserved, fiberHomes: c.fiberHomes, wirelessHomes: c.wirelessHomes, unreached: 0, towers: c.towers, aerialFt: c.aerialFt, buriedFt: c.buriedFt, dropFt: c.dropFt }, c.assumptions); return t.homes ? t.total / t.homes : 0; };
const miles = (la1: number, lo1: number, la2: number, lo2: number) => { const k = Math.cos((la1 * Math.PI) / 180); return Math.hypot((lo1 - lo2) * k, la1 - la2) * 69; };

type Sort = "need" | "cheap" | "name" | "new";

// Browse and find a county: search while typing, narrow by state, sort, pick on the map or start from where you are
export function CountyBrowser({ onPick, current }: { onPick: (slug: string) => void; current?: string | null }) {
  const index = useIndex();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [sort, setSort] = useState<Sort>("need");
  const [fccOnly, setFccOnly] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [shown, setShown] = useState(40);
  const [recent, setRecent] = useState<string[]>([]);
  const [near, setNear] = useState<{ lat: number; lon: number } | null>(null);
  const [geoErr, setGeoErr] = useState("");
  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => setShown(40), [q, st, sort, fccOnly, near]);

  const states = useMemo(() => [...new Set((index ?? []).map((c) => c.state))].sort(), [index]);
  const bySlug = useMemo(() => new Map((index ?? []).map((c) => [c.slug, c])), [index]);

  const list = useMemo(() => {
    if (!index) return [];
    // every typed word has to match the county name or its state, so "towns ga" and "georgia towns" both work
    const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
    let l = index.filter((c) => (!st || c.state === st) && (!fccOnly || c.coverageSource === "fcc") && words.every((w) => `${c.name} ${c.state} ${STATE_NAMES[c.state] ?? ""}`.toLowerCase().includes(w)));
    const cen = (c: IndexItem): [number, number] => [(c.bbox[1] + c.bbox[3]) / 2, (c.bbox[0] + c.bbox[2]) / 2];
    if (near && !q) return [...l].sort((a, b) => miles(...cen(a), near.lat, near.lon) - miles(...cen(b), near.lat, near.lon));
    if (sort === "need") l = [...l].sort((a, b) => b.unserved - a.unserved);
    else if (sort === "cheap") l = [...l].filter((c) => c.homes && c.unserved > 20).sort((a, b) => perHome(a) - perHome(b));
    else if (sort === "name") l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    else l = [...l].sort((a, b) => (b.plannedAt ?? "").localeCompare(a.plannedAt ?? ""));
    // counties planned with real FCC data come first, since their numbers are the ones to trust
    if (sort !== "name") { const f = (c: IndexItem) => (c.coverageSource === "fcc" ? 0 : 1); l = [...l].sort((x, y) => f(x) - f(y)); }
    return l;
  }, [index, q, st, sort, fccOnly, near]);

  if (!index) return <p style={{ padding: 20 }}>Loading counties</p>;
  const rec = recent.map((s) => bySlug.get(s)).filter(Boolean) as IndexItem[];
  const maxUn = Math.max(...list.slice(0, shown).map((c) => c.unserved), 1);
  const chip = (on: boolean) => ({ className: `pick-chip${on ? " on" : ""}`, "aria-pressed": on });

  return (
    <div className="cb">
      <div className="cb-bar">
        <div className="cb-search">
          <input className="field" value={q} onChange={(e) => { setQ(e.target.value); setNear(null); }} placeholder="Search a county or state" aria-label="Search counties" autoComplete="off" enterKeyHint="search" />
          {q && <button className="cb-x" onClick={() => setQ("")} aria-label="Clear search">×</button>}
        </div>
        <div className="cb-filters">
          <select className="field" value={st} onChange={(e) => setSt(e.target.value)} aria-label="State">
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s}</option>)}
          </select>
          <button {...chip(!!near)} onClick={() => {
            if (near) return setNear(null);
            setGeoErr("");
            navigator.geolocation?.getCurrentPosition((p) => { setNear({ lat: p.coords.latitude, lon: p.coords.longitude }); setQ(""); }, () => setGeoErr("Location is off. Allow it to list nearby counties."), { timeout: 8000 });
          }}>Near me</button>
          <button {...chip(fccOnly)} onClick={() => setFccOnly(!fccOnly)}>FCC data only</button>
        </div>
        <div className="cb-filters">
          {([["need", "Most homes without service"], ["cheap", "Cheapest per home"], ["new", "Newest"], ["name", "A to Z"]] as [Sort, string][]).map(([k, l]) => <button key={k} {...chip(sort === k && !near)} onClick={() => { setSort(k); setNear(null); }}>{l}</button>)}
          <span style={{ flex: 1 }} />
          <button {...chip(view === "map")} onClick={() => setView(view === "map" ? "list" : "map")}>{view === "map" ? "Back to list" : "Pick on the map"}</button>
        </div>
        {geoErr && <p className="small" role="alert">{geoErr}</p>}
      </div>

      {view === "map" ? (
        <div style={{ padding: "0 0 8px" }}>
          <p className="small" style={{ padding: "0 4px 8px" }}>Tap a blue dot to open that county. Gray dots are counties that have not been planned yet.</p>
          <UsMap height={420} onPick={(c, sl) => { if (sl) onPick(sl); else { setQ(c[1].replace(" County", "")); setView("list"); } }} />
        </div>
      ) : (
        <div>
          {!q && !st && !near && rec.length > 0 && (
            <div className="cb-recent">
              <p className="label">Recent</p>
              <div className="cb-chips">{rec.map((c) => <button key={c.slug} className="pick-chip" onClick={() => onPick(c.slug)}>{c.name.replace(" County", "")}, {c.state}</button>)}</div>
            </div>
          )}
          <p className="small" style={{ padding: "6px 4px" }}>{num(list.length)} {list.length === 1 ? "county" : "counties"}{near ? " nearest to you" : ""}{st ? ` in ${STATE_NAMES[st] ?? st}` : ""}</p>
          <div className="cb-list" role="listbox" aria-label="Counties">
            {list.slice(0, shown).map((c) => {
              const share = c.homes ? (c.unserved / c.homes) * 100 : 0, ph = perHome(c);
              return (
                <button key={c.slug} className={`cb-row${c.slug === current ? " on" : ""}`} role="option" aria-selected={c.slug === current} onClick={() => onPick(c.slug)}>
                  <span className="cb-main">
                    <b>{c.name}, {c.state}</b>
                    <span className="small">{num(c.unserved)} of {num(c.homes)} homes without service ({share < 1 ? "<1" : share.toFixed(share < 10 ? 1 : 0)}%)</span>
                    <span className="cb-bar2"><i style={{ width: `${Math.max(2, (c.unserved / maxUn) * 100)}%` }} /></span>
                  </span>
                  <span className="cb-side">
                    <b>{ph ? perHomeRange(c) : "-"}</b>
                    <span className="small">a home</span>
                    <span className={`chip ${c.coverageSource === "fcc" ? "green" : "gray"}`}>{c.coverageSource === "fcc" ? "FCC" : "Estimate"}</span>
                  </span>
                </button>
              );
            })}
            {!list.length && <p style={{ padding: 20 }}>No planned county matches. More are added as the planning run finishes.</p>}
          </div>
          {list.length > shown && <p style={{ textAlign: "center", marginTop: 10 }}><button className="btn sm line" onClick={() => setShown((n) => n + 60)}>Show more ({num(list.length - shown)} left)</button></p>}
        </div>
      )}
    </div>
  );
}

// A button that shows the current county and opens the browser as a sheet
export function CountyButton({ index, slug, onChange }: { index: IndexItem[] | null; slug: string | null; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = index?.find((c) => c.slug === slug);
  useEffect(() => { if (slug) rememberCounty(slug); }, [slug]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open]);
  if (!index || !slug) return null;
  return (
    <>
      <button className="cb-open" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span><span className="small" style={{ display: "block", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontSize: 11 }}>County</span><b>{cur ? `${cur.name}, ${cur.state}` : slug}</b></span>
        <span aria-hidden="true">Change ▾</span>
      </button>
      {open && (
        <div className="sheet-back" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose a county" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><h2 style={{ margin: 0, fontSize: 22 }}>Choose a county</h2><button className="btn sm line" onClick={() => setOpen(false)}>Close</button></div>
            <div className="sheet-body"><CountyBrowser current={slug} onPick={(s) => { onChange(s); setOpen(false); }} /></div>
          </div>
        </div>
      )}
    </>
  );
}
