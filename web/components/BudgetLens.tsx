"use client";
import { useEffect, useMemo, useState } from "react";
import { dollars, money, num } from "@/lib/cost";
import type { County } from "@/lib/data";

export default function BudgetLens({ data, onMask }: { data: County; onMask: (m: Uint8Array | null) => void }) {
  const { order, cum } = useMemo(() => {
    const o = data.homes.map((h, i) => ({ i, c: h.cost })).filter((x) => data.homes[x.i].tech > 0).sort((a, b) => a.c - b.c);
    const cu = new Float64Array(o.length);
    let t = 0;
    o.forEach((x, k) => { t += x.c; cu[k] = t; });
    return { order: o, cum: cu };
  }, [data]);
  const total = cum[cum.length - 1] || 1;
  const [pct, setPct] = useState(25);
  const [show, setShow] = useState(false);
  const budget = (total * pct) / 100;

  let lo = 0, hi = cum.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= budget) lo = mid + 1; else hi = mid; }
  const funded = lo;

  useEffect(() => {
    if (!show) { onMask(null); return; }
    const m = new Uint8Array(data.homes.length);
    order.forEach((x, k) => { m[x.i] = k < funded ? 1 : 2; });
    onMask(m);
    return () => onMask(null);
  }, [show, funded, order, data, onMask]);

  const W = 300, H = 110, pts = 60;
  const line = Array.from({ length: pts + 1 }, (_, k) => {
    const idx = Math.min(order.length - 1, Math.round((k / pts) * (order.length - 1)));
    return `${(cum[idx] / total) * W},${H - (idx / order.length) * (H - 6) - 2}`;
  }).join(" ");
  const mx = (budget / total) * W, my = H - (funded / (order.length || 1)) * (H - 6) - 2;

  return (
    <>
      <h3>What a grant would buy</h3>
      <p className="small">Pick a budget and the cheapest homes get connected first.</p>
      <input type="range" min={0} max={100} value={pct} onChange={(e) => { setPct(Number(e.target.value)); setShow(true); }} style={{ width: "100%", marginTop: 10, accentColor: "#1b5fd1" }} aria-label="Grant size" />
      <div className="box soft" style={{ marginTop: 6 }}>
        <p className="big sm">{money(budget)}</p>
        <p className="small">connects <strong>{num(funded)}</strong> of {num(order.length)} homes ({order.length ? Math.round((funded / order.length) * 100) : 0}%), about {funded ? dollars(budget / funded) : "—"} each.</p>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", marginTop: 8, display: "block" }} role="img" aria-label="Homes connected as the budget grows">
          <polyline points={line} fill="none" stroke="#0d0d0d" strokeWidth="2" />
          <line x1={mx} x2={mx} y1={0} y2={H} stroke="#1b5fd1" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx={mx} cy={my} r="5" fill="#1b5fd1" />
        </svg>
        <p className="small" style={{ marginTop: 4 }}>The curve flattens because the last homes cost the most.</p>
        <button className="btn sm line" style={{ marginTop: 8 }} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? "Hide from the map" : "Show connected homes on the map"}</button>
      </div>
    </>
  );
}
