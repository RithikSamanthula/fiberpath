"use client";
import { useRef, useState } from "react";
import AreaPicker from "@/components/pros/AreaPicker";
import { CongressDashboard, CoopDashboard, OfficeDashboard } from "@/components/pros/Dashboards";
import { useIndex } from "@/lib/useIndex";
import { Role, useWorkspace } from "@/lib/workspace";

const ROLES: { id: Role; title: string; text: string; area: string; icon: string }[] = [
  { id: "coop", title: "Electric co-op or small provider", text: "Plan a build, see the cost for each home and print a report for a grant application.", area: "Choose the counties you serve", icon: "pole" },
  { id: "office", title: "State or county broadband office", text: "See which counties connect the most homes per dollar and decide where funding goes.", area: "Choose the counties in your program", icon: "bars" },
  { id: "congress", title: "Congressional office", text: "See how many homes in your area lack internet, what it would cost to fix, and how many people are asking.", area: "Choose the counties in your district", icon: "capitol" },
];

function Icon({ k }: { k: string }) {
  const s = { stroke: "#1b5fd1", strokeWidth: 3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg className="ic" viewBox="0 0 60 60" aria-hidden="true">
      {k === "pole" && <g><path d="M30 8 L30 54" {...s} /><path d="M16 18 L44 18 M20 27 L40 27" {...s} /><path d="M4 24 Q17 36 30 18 Q43 36 56 24" {...s} strokeWidth={2} /></g>}
      {k === "bars" && <g><path d="M10 52 L10 30 M24 52 L24 14 M38 52 L38 24 M52 52 L52 38" {...s} strokeWidth={8} /></g>}
      {k === "capitol" && <g><path d="M8 50 L52 50 M12 50 L12 28 M24 50 L24 28 M36 50 L36 28 M48 50 L48 28 M6 28 L54 28 L30 10 Z" {...s} /></g>}
    </svg>
  );
}

export default function Pros() {
  const { ws, ready, update, reset, save } = useWorkspace();
  const index = useIndex();
  const [changing, setChanging] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!ready || !index) return <main className="wrap page"><p>Loading</p></main>;

  const role = ROLES.find((r) => r.id === ws.role);
  const items = index.filter((c) => ws.geoids.includes(c.geoid));
  const step = !role ? 1 : !ws.geoids.length || changing ? 2 : 3;

  return (
    <main className="wrap page" style={{ maxWidth: 1040 }}>
      <h1>For counties, co-ops and congressional offices</h1>
      <p className="lede">Plans, costs and reports for a whole service area. Your choices are saved in this browser, so there is nothing to sign up for.</p>
      <div className="steps3" aria-label="Steps"><span className={step >= 1 ? "on" : ""}>1 Who you are</span><span className={step >= 2 ? "on" : ""}>2 Your area</span><span className={step >= 3 ? "on" : ""}>3 Your dashboard</span></div>

      {step === 1 && (
        <div className="rolecards">
          {ROLES.map((r) => (
            <button key={r.id} className="rolecard" onClick={() => update({ role: r.id })}>
              <Icon k={r.icon} /><h3>{r.title}</h3><p>{r.text}</p><span className="btn sm" style={{ justifySelf: "start" }}>Choose</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && role && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ margin: "0 0 6px" }}>{role.area}</h2>
          <label style={{ display: "block", marginBottom: 14, maxWidth: 420 }}>
            <span className="label">Name for this workspace</span>
            <input className="field" style={{ minHeight: 46, fontSize: 16, marginTop: 4 }} value={ws.name} onChange={(e) => update({ name: e.target.value })} placeholder={role.id === "congress" ? "For example GA-09" : "For example Blue Ridge EMC"} />
          </label>
          <AreaPicker index={index} value={ws.geoids} onChange={(g) => update({ geoids: g })} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" disabled={!ws.geoids.length} onClick={() => setChanging(false)}>Open the dashboard</button>
            <button className="btn line" onClick={() => { update({ role: null, geoids: [] }); setChanging(false); }}>Back</button>
          </div>
        </div>
      )}

      {step === 3 && role && (
        <div style={{ marginTop: 24 }}>
          <div className="row noprint" style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <div><p className="label">{role.title}</p><h2 style={{ margin: "4px 0 0" }}>{ws.name || "Your workspace"}</h2></div>
            <div className="row">
              <button className="btn sm line" onClick={() => setChanging(true)}>Change area</button>
              <button className="btn sm line" onClick={() => update({ role: null, geoids: [] })}>Change role</button>
              <button className="btn sm line" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(ws, null, 1)], { type: "application/json" })); a.download = "fiberpath-workspace.json"; a.click(); }}>Export</button>
              <button className="btn sm line" onClick={() => file.current?.click()}>Import</button>
              <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { save({ ...ws, ...JSON.parse(await f.text()) }); } catch {} }} />
              <button className="btn sm line" onClick={reset}>Start over</button>
            </div>
          </div>
          {ws.role === "coop" && <CoopDashboard items={items} prices={ws.prices} setPrices={(p) => update({ prices: p })} />}
          {ws.role === "office" && <OfficeDashboard items={items} prices={ws.prices} />}
          {ws.role === "congress" && <CongressDashboard items={items} name={ws.name} prices={ws.prices} />}
        </div>
      )}
    </main>
  );
}
