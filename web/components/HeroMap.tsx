"use client";
import { useEffect, useMemo, useState } from "react";
import MapView, { Layers } from "@/components/MapView";
import { County, loadCountyLite } from "@/lib/data";
import { useLoop } from "@/lib/useClock";

const HOLD: [number, number] = [1, 3];
import { dollars, edgeCosts, num, totalCost } from "@/lib/cost";

const layers: Layers = { roads: true, plan: true, homes: true, towers: true, poles: false, wireless: false };

// A real county plan drawing itself, on a loop. Nothing here is mocked: it is the Towns County, GA plan.
export default function HeroMap() {
  const [d, setD] = useState<County | null>(null);
  const p = useLoop(7, HOLD, !!d);
  useEffect(() => { loadCountyLite("towns-ga").then(setD).catch(() => {}); }, []);

  const stat = useMemo(() => {
    if (!d) return null;
    const a = d.meta.assumptions;
    const c = totalCost(d.meta.totals, a);
    const cum = edgeCosts(d.plan, a);
    let tot = 0;
    const run = cum.map((x) => (tot += x));
    return { c, run, tot };
  }, [d]);

  if (!d || !stat) return <div style={{ height: 440, background: "#0a1424" }} aria-hidden="true" />;
  const n = Math.floor(p * d.plan.length);
  const spent = p >= 1 ? stat.c.total : (n ? stat.run[n - 1] / stat.tot : 0) * (stat.c.total - stat.c.wireless);
  const depth = n ? d.plan[n - 1][5] : -1;
  let homes = 0;
  if (p >= 1) homes = stat.c.homes;
  else for (const h of d.homes) if (h.tech === 1 || h.tech === 2) if (h.depth <= depth) homes++;

  return (
    <div style={{ background: "#0f1b2d", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: 380, display: "flex", flexDirection: "column" }}>
        <MapView data={d} layers={layers} progress={p} still />
      </div>
      <div style={{ display: "flex", gap: 28, padding: "14px 18px", color: "#fff", height: 84, overflow: "hidden", whiteSpace: "nowrap" }}>
        <div style={{ minWidth: 120 }}><div style={{ fontSize: 28, fontWeight: 800 }}>{num(homes)}</div><div className="label" style={{ color: "#aebad0" }}>Homes connected</div></div>
        <div style={{ minWidth: 170 }}><div style={{ fontSize: 28, fontWeight: 800 }}>{p >= 1 ? dollars(spent / homes) : dollars(spent)}</div><div className="label" style={{ color: "#aebad0" }}>{p >= 1 ? "Cost per home" : "Spent so far"}</div></div>
        <div style={{ marginLeft: "auto", alignSelf: "center", fontSize: 13, color: "#aebad0" }}>{d.meta.name}, {d.meta.state}</div>
      </div>
    </div>
  );
}
