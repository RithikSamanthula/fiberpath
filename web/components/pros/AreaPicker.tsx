"use client";
import { useMemo, useState } from "react";
import type { IndexItem } from "@/lib/data";

export default function AreaPicker({ index, value, onChange, single }: { index: IndexItem[]; value: string[]; onChange: (g: string[]) => void; single?: boolean }) {
  const states = useMemo(() => [...new Set(index.map((c) => c.state))].sort(), [index]);
  const [st, setSt] = useState(() => (value.length ? index.find((c) => c.geoid === value[0])?.state : "") || "");
  const [q, setQ] = useState("");
  const list = useMemo(() => index.filter((c) => (!st || c.state === st) && c.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [index, st, q]);
  const has = new Set(value);
  const toggle = (g: string) => onChange(single ? [g] : has.has(g) ? value.filter((x) => x !== g) : [...value, g]);
  return (
    <div>
      <div className="row" style={{ gap: 10 }}>
        <select className="field" style={{ flex: "1 1 160px" }} value={st} onChange={(e) => setSt(e.target.value)} aria-label="State">
          <option value="">All states</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className="field" style={{ flex: "2 1 220px", minHeight: 46, fontSize: 16 }} placeholder="Search counties" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search counties" />
      </div>
      {!single && st && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm line" onClick={() => onChange([...new Set([...value, ...index.filter((c) => c.state === st).map((c) => c.geoid)])])}>Add every planned county in {st}</button>
          {value.length > 0 && <button className="btn sm line" onClick={() => onChange([])}>Clear ({value.length})</button>}
        </div>
      )}
      <div className="picker">
        {list.slice(0, 120).map((c) => (
          <label key={c.geoid} className={has.has(c.geoid) ? "on" : ""}>
            <input type={single ? "radio" : "checkbox"} checked={has.has(c.geoid)} onChange={() => toggle(c.geoid)} />
            <span>{c.name}{!st ? `, ${c.state}` : ""}</span>
          </label>
        ))}
        {!list.length && <p className="small" style={{ padding: 12 }}>No planned county matches yet, but more are added as the planning run finishes.</p>}
      </div>
      <p className="small" style={{ marginTop: 6 }}>{value.length} selected{list.length > 120 ? `, showing the first 120 of ${list.length}` : ""}</p>
    </div>
  );
}
