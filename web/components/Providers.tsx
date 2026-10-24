"use client";
import { useEffect, useState } from "react";

type Offer = { brand: string; tech: string; down: number; up: number; here: boolean; homes: number; hereN: number };
const TECH_COLOR: Record<string, string> = { Fiber: "#1b5fd1", Cable: "#7a6a4f", Copper: "#8a8f99", "Fixed wireless": "#1c8c4e", Other: "#8a8f99" };

// Which companies report service near an address, and how fast, straight from the FCC's map
export default function Providers({ lat, lon, state }: { lat: number; lon: number; state: string }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [state_, setState] = useState<"loading" | "ok" | "none" | "error">("loading");
  useEffect(() => {
    let live = true;
    setState("loading");
    fetch(`/api/providers?lat=${lat}&lon=${lon}&state=${state}`).then((r) => r.json()).then((j) => {
      if (!live) return;
      if (j.error) setState("error"); else if (!j.available) setState("none"); else { setOffers(j.offers); setTotal(j.total ?? null); setState("ok"); }
    }).catch(() => live && setState("error"));
    return () => { live = false; };
  }, [lat, lon, state]);

  if (state_ === "loading") return <p className="small">Checking which providers report service here</p>;
  if (state_ === "none") return <p className="small">Provider data for this state is not loaded yet.</p>;
  if (state_ === "error" || !offers) return <p className="small">Could not load provider data right now.</p>;
  const here = offers.filter((o) => o.here);
  const list = here.length ? here : offers;
  const max = Math.max(...list.map((o) => o.down), 100);
  const best = [...list].sort((a, b) => b.down - a.down)[0];
  return (
    <div>
      {list.length === 0 ? (
        <p className="box soft">No provider reports fixed service in this neighborhood. Satellite internet is available almost everywhere, but it does not count toward the federal "served" standard.</p>
      ) : (
        <>
          <p style={{ fontSize: 18 }}>The fastest service any provider reports {here.length ? "in this area" : "nearby"} is <b>{best.down >= 1000 ? `${best.down / 1000} Gbps` : `${best.down} Mbps`}</b> down from {best.brand} ({best.tech.toLowerCase()}).{total && best.hereN && best.hereN < total * 0.7 ? <> It reaches only {best.hereN} of the {total} addresses in this area, so your own address may not get it.</> : null}</p>
          <div style={{ marginTop: 12 }}>
            {list.map((o) => (
              <div key={o.brand + o.tech} className="row3" style={{ "--c1": "260px", "--c3": "130px", padding: "7px 0", borderBottom: "1px solid var(--line)" } as React.CSSProperties}>
                <div><b>{o.brand}</b><br /><span className="small" style={{ color: TECH_COLOR[o.tech] ?? "#8a8f99", fontWeight: 700 }}>{o.tech}</span>{total && o.hereN ? <span className="small" style={{ display: "block", color: "var(--mute)" }}>Reported at {Math.min(o.hereN, total)} of {total} addresses nearby</span> : null}</div>
                <div className="bar" style={{ height: 16, marginTop: 0 }}><i style={{ width: `${Math.max(3, (o.down / max) * 100)}%`, background: TECH_COLOR[o.tech] ?? "#8a8f99" }} /></div>
                <span className="small" style={{ textAlign: "right" }}>{o.down} down, {o.up} up (Mbps)</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="small" style={{ marginTop: 10 }}>Providers report service for a small area, not for each house, so call them to confirm your address. If a listing is wrong, you can <a href="https://www.fcc.gov/BroadbandData/consumers">file a challenge with the FCC</a>. Data: FCC National Broadband Map, December 2025.</p>
    </div>
  );
}
