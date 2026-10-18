"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/cost";
import UsMap from "@/components/UsMap";

const STATES: [string, string][] = [["01","Alabama"],["02","Alaska"],["04","Arizona"],["05","Arkansas"],["06","California"],["08","Colorado"],["09","Connecticut"],["10","Delaware"],["11","District of Columbia"],["12","Florida"],["13","Georgia"],["15","Hawaii"],["16","Idaho"],["17","Illinois"],["18","Indiana"],["19","Iowa"],["20","Kansas"],["21","Kentucky"],["22","Louisiana"],["23","Maine"],["24","Maryland"],["25","Massachusetts"],["26","Michigan"],["27","Minnesota"],["28","Mississippi"],["29","Missouri"],["30","Montana"],["31","Nebraska"],["32","Nevada"],["33","New Hampshire"],["34","New Jersey"],["35","New Mexico"],["36","New York"],["37","North Carolina"],["38","North Dakota"],["39","Ohio"],["40","Oklahoma"],["41","Oregon"],["42","Pennsylvania"],["44","Rhode Island"],["45","South Carolina"],["46","South Dakota"],["47","Tennessee"],["48","Texas"],["49","Utah"],["50","Vermont"],["51","Virginia"],["53","Washington"],["54","West Virginia"],["55","Wisconsin"],["56","Wyoming"]];

type C = { name: string; geoid: string; lat: number; lon: number; slug: string | null };

export default function Explore() {
  const [st, setSt] = useState("13");
  const [list, setList] = useState<C[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const u = new URLSearchParams(location.search);
    if (u.get("st")) setSt(u.get("st")!);
    if (u.get("q")) setQ(u.get("q")!);
  }, []);

  useEffect(() => {
    let live = true;
    setList(null);
    setErr(null);
    fetch(`/api/counties?state=${st}`).then((r) => r.json()).then((j) => {
      if (!live) return;
      if (j.error) setErr(j.error); else setList(j.counties);
    }).catch(() => live && setErr("Could not load counties."));
    return () => { live = false; };
  }, [st]);

  const shown = useMemo(() => (list ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase())), [list, q]);

  async function request(c: C) {
    let client = "";
    try {
      client = localStorage.getItem("fp-client") || "";
      if (!client) { client = crypto.randomUUID(); localStorage.setItem("fp-client", client); }
    } catch { client = crypto.randomUUID(); }
    const r = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geoid: c.geoid, lat: c.lat, lon: c.lon, client }) });
    const j = await r.json();
    if (r.ok) { setSent((s) => ({ ...s, [c.geoid]: true })); setCounts((n) => ({ ...n, [c.geoid]: j.requests })); }
  }

  return (
    <main className="wrap page">
      <h1>Explore the country</h1>
      <p className="lede">Pick a state to see its counties. Counties with a full plan open straight to the map. For the rest, ask for a plan: the counties with the most requests get planned first.</p>

      <div style={{ marginTop: 28 }}><UsMap onPick={(c, slug) => { if (slug) location.href = `/county?county=${slug}`; else { setSt(c[2]); setQ(c[1].replace(" County", "")); } }} /></div>
      <p className="small" style={{ marginTop: 8 }}>Each dot is a county. Blue dots with a white ring have a full plan. Click any dot.</p>

      <div className="row" style={{ marginTop: 28 }}>
        <label style={{ flex: "1 1 240px" }}><span className="label">State</span>
          <select className="field" style={{ marginTop: 4 }} value={st} onChange={(e) => setSt(e.target.value)}>
            {STATES.map(([f, n]) => <option key={f} value={f}>{n}</option>)}
          </select></label>
        <label style={{ flex: "1 1 240px" }}><span className="label">Find a county</span>
          <input className="field" style={{ marginTop: 4, minHeight: 46, fontSize: 16 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a name" /></label>
      </div>

      {err && <p className="box red" style={{ marginTop: 24 }} role="alert">{err}</p>}
      {!list && !err && <p style={{ marginTop: 24 }}>Loading counties…</p>}
      {list && (
        <div className="list" style={{ marginTop: 24 }}>
          {shown.map((c) => (
            <div className="item" key={c.geoid}>
              <div>
                <strong>{c.name}</strong>{" "}
                {c.slug ? <span className="chip green">Planned</span> : <span className="chip gray">Not planned yet</span>}
                {counts[c.geoid] ? <span className="small"> · {num(counts[c.geoid])} requests</span> : null}
              </div>
              <div className="row">
                {c.slug ? (
                  <>
                    <Link className="btn sm line" href={`/report?county=${c.slug}`}>Grant report</Link>
                    <Link className="btn sm" href={`/county?county=${c.slug}`}>View plan</Link>
                  </>
                ) : (
                  <button className="btn sm line" disabled={sent[c.geoid]} onClick={() => request(c)}>{sent[c.geoid] ? "Requested" : "Request a plan"}</button>
                )}
              </div>
            </div>
          ))}
          {!shown.length && <p style={{ padding: "16px 0" }}>No county matches.</p>}
        </div>
      )}

      <div className="box soft" style={{ marginTop: 40 }}>
        <h3 style={{ marginTop: 0 }}>Do you run a co-op, ISP or county office?</h3>
        <p>You do not have to wait. The planning pipeline runs on any U.S. county from public data. See <Link href="/about#run">how to run it</Link>.</p>
      </div>
    </main>
  );
}
