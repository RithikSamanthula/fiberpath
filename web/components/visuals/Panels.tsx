"use client";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Layers } from "@/components/MapView";
import Terrain3D from "@/components/Terrain3D";
import { County, ensureGrids, loadCountyLite } from "@/lib/data";
import { dollars, edgeCosts, num, totalCost } from "@/lib/cost";
import { viewshed } from "@/lib/geo";
import { useLoop } from "@/lib/useClock";

const HOLD: [number, number] = [0.8, 3.5];

function useVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVis(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, vis] as const;
}

function useTowns(active: boolean, grids = false) {
  const [d, setD] = useState<County | null>(null);
  useEffect(() => {
    if (!active) return;
    loadCountyLite("towns-ga").then((c) => (grids ? ensureGrids(c) : c)).then((c) => setD({ ...c })).catch(() => {});
  }, [active, grids]);
  return d;
}

function Frame({ title, big, note, children, tall, forwardRef }: { title: string; big: string; note: string; children: ReactNode; tall?: boolean; forwardRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <figure ref={forwardRef} style={{ margin: 0, background: "#0f1b2d", borderRadius: 0, overflow: "hidden", position: "relative", height: tall ? 460 : 380, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      <figcaption style={{ position: "absolute", left: 0, bottom: 0, right: 0, padding: "14px 16px", background: "#0a1424", color: "#fff", display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", height: 104, overflow: "hidden", alignContent: "flex-start" }}>
        <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap", minWidth: 150 }}>{big}</span>
        <span className="label" style={{ color: "#8fa3c4" }}>{title}</span>
        <span className="small" style={{ color: "#c6d1e4", flexBasis: "100%" }}>{note}</span>
      </figcaption>
    </figure>
  );
}

const L = (o: Partial<Layers>): Layers => ({ roads: true, plan: false, homes: false, towers: false, poles: false, wireless: false, ...o });

export function HomesPanel() {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const d = useTowns(vis);
  return (
    <Frame forwardRef={ref} title="Homes found" big={d ? num(d.meta.totals.homesAll) : "—"} note="Building outlines from satellite images, with sheds and barns removed">
      {d && <MapView data={d} layers={L({ homes: true })} progress={0} still focus={{ lon: -83.86, lat: 34.97, zoom: 9000, key: 1 }} />}
    </Frame>
  );
}

export function PolesPanel() {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const d = useTowns(vis);
  return (
    <Frame forwardRef={ref} title="Utility poles found" big={d ? num(d.meta.poleCount) : "—"} note="Poles spotted in street photos, because roads that have poles are cheaper to build on">
      {d && <MapView data={d} layers={L({ poles: true, plan: true })} progress={1} still focus={{ lon: -83.76, lat: 34.95, zoom: 9000, key: 2 }} />}
    </Frame>
  );
}

export function WirelessPanel() {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const d = useTowns(vis, true);
  const tower = useMemo(() => (d ? d.towers.filter((t) => t.used).sort((a, b) => b.homes - a.homes)[0] : null), [d]);
  const vs = useMemo(() => (d && tower?.id !== undefined ? viewshed(d, tower.lon, tower.lat, d.homes) : null), [d, tower]);
  return (
    <Frame forwardRef={ref} title="Homes this tower can reach" big={vs ? num(vs.seen) : "—"} note={vs ? `Green homes have a clear path past the hills and trees, and ${num(vs.total - vs.seen)} nearby homes are blocked` : "Hills and trees decide what a signal can reach"}>
      {d && tower && vs && <MapView data={d} layers={L({ homes: false })} progress={0} still reach={vs.res} ghost={{ lon: tower.lon, lat: tower.lat }} focus={{ lon: tower.lon, lat: tower.lat, zoom: 5200, key: 3 }} />}
    </Frame>
  );
}

export function NetworkPanel() {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const d = useTowns(vis);
  const p = useLoop(7.7, HOLD, !!d);
  const stat = useMemo(() => {
    if (!d) return null;
    const a = d.meta.assumptions, c = totalCost(d.meta.totals, a);
    const run: number[] = []; let tot = 0;
    for (const x of edgeCosts(d.plan, a)) run.push((tot += x));
    return { c, run, tot };
  }, [d]);
  const n = d ? Math.floor(p * d.plan.length) : 0;
  const spent = stat ? (p >= 1 ? stat.c.total : (n ? stat.run[n - 1] / stat.tot : 0) * (stat.c.total - stat.c.wireless)) : 0;
  return (
    <Frame forwardRef={ref} title="Cost to connect everyone" big={stat ? (p >= 1 ? dollars(stat.c.perHome) + " a home" : dollars(spent)) : "—"} note="The cheapest set of roads that reaches every home">
      {d && <MapView data={d} layers={L({ plan: true, homes: true, towers: true })} progress={p} still pulse />}
    </Frame>
  );
}

export function TerrainPanel() {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const d = useTowns(vis, true);
  return (
    <Frame forwardRef={ref} tall title="The county in 3D" big="3D" note="The hills, the forest and every route, which you can drag to turn">
      {d && <Terrain3D data={d} progress={1} spin compact />}
    </Frame>
  );
}
