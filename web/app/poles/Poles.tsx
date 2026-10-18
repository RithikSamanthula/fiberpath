"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import MapView, { Layers } from "@/components/MapView";
import { num } from "@/lib/cost";
import type { Home } from "@/lib/data";
import { distM } from "@/lib/geo";
import Scanner from "@/components/cv/Scanner";
import { CountySelect, useCountyParam } from "@/lib/useCounty";

export default function Poles() {
  const { data, error, index, slug, setSlug } = useCountyParam();
  const [sel, setSel] = useState<Home | null>(null);
  const q = useSearchParams();
  useEffect(() => {
    const h = q.get("home");
    if (data && h != null && data.homes[Number(h)]) setSel(data.homes[Number(h)]);
    else if (data && !sel) setSel(data.homes.find((x) => x.status === 2 && x.poles > 0) ?? data.homes.find((x) => x.status === 2) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q]);
  const layers: Layers = { roads: true, plan: true, homes: true, towers: false, poles: true, wireless: false };

  if (error) return <main className="wrap page"><p>{error}</p></main>;
  if (!data) return <main className="wrap page"><p>Loading the county</p></main>;

  const { totals, poleSource, poleCount } = data.meta;
  let aerialM = 0, buriedM = 0;
  for (const e of data.plan) {
    const m = distM(e[0], e[1], e[2], e[3]);
    if (e[4] === 1) aerialM += m; else buriedM += m;
  }
  const pct = aerialM + buriedM ? (aerialM / (aerialM + buriedM)) * 100 : 0;
  const nearPoles = sel ? data.poles.filter((p) => distM(p[0], p[1], sel.lon, sel.lat) < 60).length : 0;

  return (
    <div className="app">
      <div className="stage">
        <div className="topbar">
          <div className="stat"><div className="big">{num(poleCount)}</div><span className="label">Poles found</span></div>
          <div className="stat"><div className="big">{pct.toFixed(pct < 10 ? 1 : 0)}%</div><span className="label">Planned route on poles</span></div>
          <div className="stat"><div className="big">{num(totals.aerialFt / 5280)} mi</div><span className="label">Aerial fiber</span></div>
          <div className="stat"><div className="big">{num(totals.buriedFt / 5280)} mi</div><span className="label">Buried fiber</span></div>
        </div>
        <MapView data={data} layers={layers} selected={sel} onPick={setSel} />
        <div className="legend noprint">
          <div><span className="sw" /> Route on poles</div>
          <div><span className="sw amber" /> Route buried</div>
          <div><span style={{ width: 28, textAlign: "center", fontWeight: 700, color: "#4d8dff" }}>+</span> Utility pole</div>
        </div>
      </div>
      <aside className="side">
        <CountySelect index={index} slug={slug} onChange={setSlug} />
        <h3>Pole inspector</h3>
        <p className="small">Tap a home on the map to see the street photos near it, with utility poles marked.</p>
        {!sel && <p style={{ marginTop: 12 }}>No home selected yet.</p>}
        {sel && (
          <>
            <p style={{ marginTop: 12 }}>{nearPoles} {nearPoles === 1 ? "pole" : "poles"} within 60 m. Route here: <strong>{sel.tech === 1 ? "on poles" : sel.tech === 2 ? "buried" : sel.tech === 3 ? "wireless, no route" : "not in plan"}</strong>.</p>
            <Scanner lat={sel.lat} lon={sel.lon} />
          </>
        )}
        <h3>How poles set the price</h3>
        <p>
          A road with poles is priced as aerial fiber. A road without them is priced as buried fiber, which costs about twice as much per foot. The optimizer prefers roads that already have poles.
        </p>
        <p className="small" style={{ marginTop: 10 }}>Pole source: {poleSource}.</p>
      </aside>
    </div>
  );
}
