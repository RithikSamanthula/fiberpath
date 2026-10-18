"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useIndex } from "@/lib/useIndex";
import { num } from "@/lib/cost";

const ago = (iso?: string, now = Date.now()) => {
  if (!iso) return "";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  return s < 90 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};

// The pipeline's output as it arrives: the newest counties, with how long ago each one finished.
export default function LiveFeed({ count = 6 }: { count?: number }) {
  const idx = useIndex();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (!idx) return null;
  const latest = [...idx].filter((i) => i.plannedAt).sort((a, b) => b.plannedAt!.localeCompare(a.plannedAt!)).slice(0, count);
  const lastHour = idx.filter((i) => i.plannedAt && now - new Date(i.plannedAt).getTime() < 3600_000).length;
  return (
    <div className="box soft" aria-live="polite">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <p className="label"><span style={{ display: "inline-block", width: 9, height: 9, background: "var(--green)", borderRadius: "50%", marginRight: 8 }} />Live from the pipeline</p>
        <p className="small">{num(idx.length)} counties planned · {num(lastHour)} in the last hour</p>
      </div>
      <div className="list" style={{ marginTop: 8, borderTop: 0 }}>
        {latest.map((c) => (
          <div className="item" key={c.geoid} style={{ padding: "8px 0" }}>
            <Link href={`/county?county=${c.slug}`}><strong>{c.name}, {c.state}</strong></Link>
            <span className="small">{num(c.unserved)} unserved homes · {ago(c.plannedAt, now)}</span>
          </div>
        ))}
        {!latest.length && <p className="small" style={{ paddingTop: 8 }}>Waiting for the next county to finish.</p>}
      </div>
    </div>
  );
}
