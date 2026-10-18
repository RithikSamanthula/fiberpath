"use client";
import { useRef, useState } from "react";
import AreaPicker from "@/components/pros/AreaPicker";
import Workspace from "@/components/pros/Dashboards";
import { useIndex } from "@/lib/useIndex";
import { useWorkspace } from "@/lib/workspace";

export default function Pros() {
  const { ws, ready, update, reset, save } = useWorkspace();
  const index = useIndex();
  const [changing, setChanging] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!ready || !index) return <main className="wrap page"><p>Loading</p></main>;

  const items = index.filter((c) => ws.geoids.includes(c.geoid));
  const step = !ws.geoids.length || changing ? 1 : 2;

  return (
    <main className="wrap page" style={{ maxWidth: 1040 }}>
      <h1>For counties, co-ops and congressional offices</h1>
      <p className="lede">Plans, costs and reports for a whole service area, district or state. Your choices are saved in this browser, so there is nothing to sign up for.</p>
      <div className="steps3" aria-label="Steps"><span className="on">1 Choose your area</span><span className={step === 2 ? "on" : ""}>2 Your dashboard</span></div>

      {step === 1 && (
        <div style={{ marginTop: 20 }}>
          <label style={{ display: "block", marginBottom: 14, maxWidth: 420 }}>
            <span className="label">Name for this workspace</span>
            <input className="field" style={{ minHeight: 46, fontSize: 16, marginTop: 4 }} value={ws.name} onChange={(e) => update({ name: e.target.value })} placeholder="For example Blue Ridge EMC, or GA-09" />
          </label>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Pick the counties you serve, fund or represent</p>
          <AreaPicker index={index} value={ws.geoids} onChange={(g) => update({ geoids: g })} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" disabled={!ws.geoids.length} onClick={() => setChanging(false)}>Open the dashboard</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 24 }}>
          <div className="row noprint" style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>{ws.name || "Your workspace"}</h2>
            <div className="row">
              <button className="btn sm line" onClick={() => setChanging(true)}>Change counties</button>
              <button className="btn sm line" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(ws, null, 1)], { type: "application/json" })); a.download = "fiberpath-workspace.json"; a.click(); }}>Export</button>
              <button className="btn sm line" onClick={() => file.current?.click()}>Import</button>
              <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { save({ ...ws, ...JSON.parse(await f.text()) }); } catch {} }} />
              <button className="btn sm line" onClick={reset}>Start over</button>
            </div>
          </div>
          <Workspace items={items} name={ws.name} prices={ws.prices} setPrices={(p) => update({ prices: p })} />
        </div>
      )}
    </main>
  );
}
