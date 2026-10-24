"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MapView, { Layers } from "@/components/MapView";
import { num } from "@/lib/cost";
import type { Home } from "@/lib/data";
import { distM, profile } from "@/lib/geo";
import { CountySelect, useCountyParam } from "@/lib/useCounty";

const layers: Layers = { roads: true, plan: false, homes: true, towers: true, poles: false, wireless: false };

export default function Sight() {
  const { data, error, index, slug, setSlug } = useCountyParam();
  const q = useSearchParams();
  const [homeI, setHomeI] = useState<number | null>(null);
  const [towerI, setTowerI] = useState<number | null>(null);

  const examples = useMemo(() => {
    if (!data) return [];
    const blocked = data.homes
      .filter((h) => (h.tech === 1 || h.tech === 2) && (h.why === 1 || h.why === 2) && h.blockedTower >= 0)
      .map((h) => ({ h, d: distM(h.lon, h.lat, data.towers[h.blockedTower].lon, data.towers[h.blockedTower].lat) }))
      .filter((x) => x.d > 1200)
      .sort((a, b) => a.d - b.d);
    const picks: Home[] = [];
    for (let i = 0; i < blocked.length && picks.length < 15; i += Math.max(1, Math.floor(blocked.length / 15))) picks.push(blocked[i].h);
    const wl = data.homes.filter((h) => h.tech === 3);
    for (let i = 0; i < wl.length && picks.length < 24; i += Math.max(1, Math.floor(wl.length / 9))) picks.push(wl[i]);
    return picks;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const fromUrl = q.get("home");
    const start = fromUrl != null ? data.homes[Number(fromUrl)] : examples[0];
    if (start && homeI === null) choose(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, examples]);

  function choose(h: Home) {
    if (!data) return;
    setHomeI(h.i);
    const t = h.tech === 3 ? h.tower : h.blockedTower;
    if (t >= 0) setTowerI(t);
    else {
      let best = 0, bd = Infinity;
      data.towers.forEach((tw, i) => { const d = distM(tw.lon, tw.lat, h.lon, h.lat); if (d < bd) { bd = d; best = i; } });
      setTowerI(best);
    }
  }

  const home = data && homeI !== null ? data.homes[homeI] : null;
  const tower = data && towerI !== null ? data.towers[towerI] : null;
  const p = useMemo(() => (data && home && tower ? profile(data, tower, home) : null), [data, home, tower]);

  if (error) return <main className="wrap page"><p>{error}</p></main>;
  if (!data) return <main className="wrap page"><p>Loading the county</p></main>;

  return (
    <main className="wrap page">
      <h1>Can a tower reach this home?</h1>
      <p className="lede">A wireless signal needs a clear path from the tower to the home, with some room around it. Hills and trees block it even when the map looks flat. This is a side view of the ground between the two.</p>
      <div style={{ maxWidth: 360, marginTop: 20 }}><CountySelect index={index} slug={slug} onChange={setSlug} /></div>

      <div className="row" style={{ marginTop: 24, alignItems: "stretch" }}>
        <label style={{ flex: "1 1 280px" }}>
          <span className="label">Home</span>
          <select className="field" style={{ marginTop: 4 }} value={homeI ?? ""} onChange={(e) => choose(data.homes[Number(e.target.value)])}>
            {home && !examples.some((h) => h.i === home.i) && <option value={home.i}>Selected on map</option>}
            {examples.map((h) => (
              <option key={h.i} value={h.i}>
                {h.tech === 3 ? "Wireless works" : "Needs fiber"} · {h.lat.toFixed(4)}, {h.lon.toFixed(4)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: "1 1 280px" }}>
          <span className="label">Tower</span>
          <select className="field" style={{ marginTop: 4 }} value={towerI ?? ""} onChange={(e) => setTowerI(Number(e.target.value))}>
            {data.towers.map((t, i) => (
              <option key={i} value={i}>Tower {i + 1} · {t.kind === "existing" ? "existing site" : "ridge site"}{t.used ? ` · serves ${t.homes} homes` : ""}</option>
            ))}
          </select>
        </label>
      </div>

      {p && home && tower && (
        <>
          <div className={`box ${p.visible ? "green" : "red"}`} style={{ marginTop: 24 }}>
            <p className="big sm">{p.visible ? "Clear path" : p.blockedByTerrain ? "Blocked by a ridge" : "Blocked by trees"}</p>
            <p style={{ marginTop: 8 }}>
              {p.dist > 7000
                ? `The home is ${(p.dist / 1000).toFixed(1)} km from the tower, past the 7 km we plan for. `
                : ""}
              {p.visible
                ? `The signal path clears terrain and trees by ${p.margin < 900 ? p.margin.toFixed(1) : "—"} m at its tightest point, ${(p.d[p.worst] / 1000).toFixed(1)} km from the tower. This home can be served by wireless.`
                : `${p.blockedByTerrain ? "Terrain" : "Tree canopy"} reaches ${Math.abs(p.margin).toFixed(1)} m into the clear zone ${(p.d[p.worst] / 1000).toFixed(1)} km from the tower. This home needs fiber instead.`}
            </p>
          </div>

          <Chart p={p} />
          <p className="small" style={{ marginTop: 8 }}>
            {(p.dist / 1000).toFixed(2)} km path · tower {num(25)} m, home {num(6)} m above ground · 5.8 GHz. The dashed green or red line is the signal path, the amber line is the lower edge of the clear space the signal needs, the hatched green areas are trees and the dark area is the ground.
          </p>

          <div style={{ height: 380, marginTop: 24, border: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
            <MapView data={data} layers={layers} selected={home} onPick={(h) => h && choose(h)} link={{ a: [tower.lon, tower.lat], b: [home.lon, home.lat] }} focus={{ lon: (tower.lon + home.lon) / 2, lat: (tower.lat + home.lat) / 2, zoom: Math.min(160000, 5.2e6 / Math.max(p.dist, 800) * 0.9) , key: home.i * 100 + tower.id }} />
          </div>
          <p className="small" style={{ marginTop: 8 }}>Tap a home on the map to check it against the tower.</p>
        </>
      )}
    </main>
  );
}

function Chart({ p }: { p: ReturnType<typeof profile> }) {
  const W = 900, H = 360, L = 56, R = 16, T = 20, B = 40;
  const lo = Math.min(...p.ground) - 15;
  const hi = Math.max(...p.line, ...p.surface) + 15;
  const x = (d: number) => L + (d / p.dist) * (W - L - R);
  const y = (e: number) => T + (1 - (e - lo) / (hi - lo)) * (H - T - B);
  const poly = (a: number[]) => a.map((v, i) => `${x(p.d[i]).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const base = y(lo);
  const groundArea = `${x(0)},${base} ${poly(p.ground)} ${x(p.dist)},${base}`;
  const canopyArea = `${poly(p.surface)} ${p.d.map((_, i) => p.d.length - 1 - i).map((i) => `${x(p.d[i]).toFixed(1)},${y(p.ground[i]).toFixed(1)}`).join(" ")}`;
  const xt = [0, 0.25, 0.5, 0.75, 1];
  const step = (hi - lo) > 400 ? 100 : 50;
  const yt: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yt.push(v);
  const wx = x(p.d[p.worst]);
  return (
    <svg className="chart" style={{ marginTop: 16 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Terrain and tree profile between the tower and the home">
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#1c8c4e" strokeWidth="1.6" />
        </pattern>
      </defs>
      {yt.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#111" strokeWidth="0.4" strokeDasharray="2 4" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end">{v} m</text>
        </g>
      ))}
      <polygon points={canopyArea} fill="url(#hatch)" stroke="none" />
      <polygon points={groundArea} fill="#0f1b2d" />
      <polyline points={poly(p.lower)} fill="none" stroke="#f2a900" strokeWidth="2" />
      <polyline points={poly(p.line)} fill="none" stroke={p.visible ? "#1c8c4e" : "#d64533"} strokeWidth="2" strokeDasharray="7 5" />
      {!p.visible && (
        <g>
          <line x1={wx} x2={wx} y1={T} y2={H - B} stroke="#d64533" strokeWidth="2" />
          <rect x={Math.min(wx + 6, W - 150)} y={T + 2} width="140" height="22" fill="#d64533" />
          <text x={Math.min(wx + 12, W - 144)} y={T + 17} style={{ fill: "#fff", fontWeight: 700 }}>Blocked here</text>
        </g>
      )}
      {xt.map((f) => (
        <text key={f} x={x(p.dist * f)} y={H - 16} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}>{((p.dist * f) / 1000).toFixed(1)} km</text>
      ))}
      <text x={x(0) + 6} y={y(p.line[0]) - 8}>Tower</text>
      <text x={x(p.dist) - 6} y={y(p.line[p.line.length - 1]) - 8} textAnchor="end">Home</text>
    </svg>
  );
}
