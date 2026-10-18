"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Glossary from "@/components/Glossary";
import HomeContext from "@/components/HomeContext";
import Search from "@/components/Search";
import { dollars, num } from "@/lib/cost";
import type { Home } from "@/lib/data";

type Result = {
  matched: string;
  lon: number;
  lat: number;
  county: { name: string; geoid: string; state: string } | null;
  planned: boolean;
  slug?: string;
  home?: Home | null;
  homeMeters?: number;
  coverageSource?: "fcc" | "proxy";
  acs?: { households: number; noInternetPct: number } | null;
  requests?: number;
};

type Estimate = {
  roadMeters: number | null;
  roadName: string;
  polesChecked: boolean;
  polesOnRoad: number | null;
  homesNearby: number | null;
  town: { name: string; km: number; kind: string } | null;
  partial: boolean;
};

const WHY: Record<number, string> = {
  1: "A ridge blocks the nearest tower, so wireless cannot reach this home.",
  2: "Trees block the nearest tower, so wireless cannot reach this home.",
  3: "No planned tower is within range.",
  4: "A tower can see this home, but fiber is the cheaper way to reach it.",
};

const stateOffice = (st: string) =>
  st === "GA"
    ? { name: "the Georgia broadband program", href: "https://broadband.georgia.gov" }
    : { name: "your state broadband office (listed on BroadbandUSA)", href: "https://broadbandusa.ntia.gov" };

export default function Household() {
  const address = useSearchParams().get("address") ?? "";
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState<Estimate | null>(null);
  const [estBusy, setEstBusy] = useState(false);
  const [pledge, setPledge] = useState<{ state: "idle" | "saving" | "done" | "error"; total?: number; msg?: string }>({ state: "idle" });
  const [reqState, setReqState] = useState<{ state: "idle" | "done" | "error"; n?: number }>({ state: "idle" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    let live = true;
    setBusy(true);
    setRes(null);
    setErr(null);
    setEst(null);
    setPledge({ state: "idle" });
    setReqState({ state: "idle" });
    fetch(`/api/lookup?address=${encodeURIComponent(address)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!live) return;
        if (!r.ok) { setErr(j.error || "Something went wrong."); return; }
        setRes(j);
        if (!j.planned) {
          setEstBusy(true);
          fetch(`/api/estimate?lat=${j.lat}&lon=${j.lon}`).then((x) => x.json()).then((e) => live && setEst(e)).catch(() => {}).finally(() => live && setEstBusy(false));
        }
      })
      .catch(() => live && setErr("Could not reach the server."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [address]);

  async function raise() {
    if (!res) return;
    setPledge({ state: "saving" });
    try {
      const body = res.slug ? { slug: res.slug, lon: res.lon, lat: res.lat } : { geoid: res.county?.geoid, lon: res.lon, lat: res.lat };
      const r = await fetch("/api/pledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setPledge({ state: "error", msg: j.error });
      else setPledge({ state: "done", total: j.total });
    } catch {
      setPledge({ state: "error", msg: "Could not save right now." });
    }
  }

  async function requestPlan() {
    if (!res?.county) return;
    let client = "";
    try {
      client = localStorage.getItem("fp-client") || "";
      if (!client) { client = crypto.randomUUID(); localStorage.setItem("fp-client", client); }
    } catch { client = crypto.randomUUID(); }
    const r = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geoid: res.county.geoid, lat: res.lat, lon: res.lon, client }) });
    const j = await r.json();
    setReqState(r.ok ? { state: "done", n: j.requests } : { state: "error" });
  }

  const h = res?.home;
  const office = stateOffice(res?.county?.state ?? "");
  const countyName = res?.county ? `${res.county.name}, ${res.county.state}` : "your county";

  return (
    <main className="wrap page">
      <Search initial={address} />

      {busy && <p style={{ marginTop: 32 }}>Looking up your address…</p>}
      {err && <p className="box red" style={{ marginTop: 32 }} role="alert">{err}</p>}
      {!address && !busy && <p style={{ marginTop: 32 }}>Enter any U.S. address above.</p>}

      {res && (
        <section style={{ marginTop: 32 }}>
          <div className="row noprint" style={{ justifyContent: "space-between" }}>
            <p className="small">{res.matched} · {countyName}</p>
            <div className="row">
              <button className="btn sm line" onClick={() => { navigator.clipboard?.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? "Link copied" : "Copy link"}</button>
              <button className="btn sm line" onClick={() => window.print()}>Print this answer</button>
            </div>
          </div>

          {res.planned && !h && (
            <div className="box soft" style={{ marginTop: 20 }}>
              <h2 style={{ margin: 0 }}>No home found at that address</h2>
              <p style={{ marginTop: 8 }}>The address is inside {countyName}, but no building is within 250 m of it. Check the address, or pick your home on the county map.</p>
              <p style={{ marginTop: 12 }}><Link className="btn" href={`/county?county=${res.slug}`}>Open the county map</Link></p>
            </div>
          )}

          {res.planned && h && (
            <>
              <div className={`box ${["green", "amber", "red"][h.status]}`} style={{ marginTop: 20 }}>
                <p className="label">Your status</p>
                <p className="big" style={{ marginTop: 8 }}>{["Served", "Underserved", "Unserved"][h.status]}</p>
                <p style={{ marginTop: 10, fontSize: 18 }}>
                  {h.status === 0 && "Internet of at least 100 Mbps is listed for this area."}
                  {h.status === 1 && "Some service is listed here, but it is slower than 100 Mbps down and 20 Mbps up."}
                  {h.status === 2 && "No internet of at least 25 Mbps down and 3 Mbps up is listed for this area."}
                </p>
                <p className="small" style={{ marginTop: 8 }}>
                  Source: {res.coverageSource === "fcc" ? "FCC National Broadband Map" : "modeled estimate. Town centers and densely built areas count as served until FCC data is loaded"}.
                </p>
              </div>

              {h.status === 2 && h.tech !== 0 && (
                <>
                  <h2>Your path to a connection</h2>
                  <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
                    <span className={`chip ${["", "blue", "amber", "green"][h.tech]}`}>{["", "Fiber on poles", "Buried fiber", "Fixed wireless"][h.tech]}</span>
                  </div>
                  <p style={{ marginTop: 10, fontSize: 18 }}>
                    {h.tech === 1 && `Poles run along your road (${h.poles} found near your route), so fiber can hang on them. That is the cheapest way to build.`}
                    {h.tech === 2 && "No utility poles were found along the road your fiber would follow, so it would be buried."}
                    {h.tech === 3 && "A planned tower has a clear line of sight to your home. Terrain and tree height were checked along the whole path."}
                    {(h.tech === 1 || h.tech === 2) && h.why > 0 && ` ${WHY[h.why]}`}
                  </p>
                  <p style={{ marginTop: 12 }}><Link href={`/sight?county=${res.slug}&home=${h.i}`}>See the line-of-sight picture</Link></p>

                  <h2>What it would cost</h2>
                  <p className="big">{dollars(h.cost)}</p>
                  <p style={{ marginTop: 10 }}>
                    {h.tech === 3
                      ? "That is your share of the tower plus your own antenna."
                      : `That is your share of the route plus a ${num(h.dropFt)} ft connection from the road to your home.`}
                    {h.tech !== 3 && (h.neighbors > 0
                      ? ` ${num(h.neighbors)} ${h.neighbors === 1 ? "neighbor shares" : "neighbors share"} the same route within 300 m, which keeps each home cheaper.`
                      : " No neighbors are close, so you carry more of the route.")}
                  </p>
                </>
              )}

              {h.status === 2 && h.tech === 0 && (
                <p style={{ marginTop: 20 }}>The road next to this home is not connected to the rest of the mapped network, so it is not in the plan yet.</p>
              )}

              {h.status !== 0 && <RaiseHand county={res.county?.name ?? ""} pledge={pledge} onRaise={raise} />}
              <Next office={office} served={h.status === 0} />
            </>
          )}

          {!res.planned && (
            <>
              <div className="box soft" style={{ marginTop: 20 }}>
                <p className="label">Your area</p>
                <p className="big sm" style={{ marginTop: 8 }}>{countyName}</p>
                <p style={{ marginTop: 10 }}>
                  FiberPath has not built a full plan for this county yet, so there is no exact status or price for your home. Here is what can be checked for any address.
                </p>
                {res.acs && (
                  <p style={{ marginTop: 10 }}>
                    <strong>{res.acs.noInternetPct}%</strong> of {num(res.acs.households)} households in your Census block group report no internet access.
                  </p>
                )}
              </div>

              <h2>Around your address</h2>
              {estBusy && <p>Checking nearby roads, poles and homes…</p>}
              {est && (
                <>
                  <div className="stats">
                    <div className="stat"><div className="big sm">{est.town ? `${est.town.km} km` : "—"}</div><span className="label">{est.town ? `To ${est.town.name}` : "Nearest town"}</span></div>
                    <div className="stat"><div className="big sm">{est.polesOnRoad === null ? "—" : est.polesOnRoad > 0 ? "Yes" : "None seen"}</div><span className="label">Poles on your road</span></div>
                    <div className="stat"><div className="big sm">{est.homesNearby ?? "—"}</div><span className="label">Homes within 300 m</span></div>
                  </div>
                  {est.partial && <p className="small" style={{ marginTop: 8 }}>Some map data did not respond, so these numbers may be incomplete.</p>}
                  {est.polesOnRoad === 0 && <p className="small" style={{ marginTop: 8 }}>“None seen” means no pole detections in street-level photos. It does not prove there are no poles.</p>}
                  <Calculator est={est} />
                </>
              )}

              <RaiseHand county={res.county?.name ?? ""} pledge={pledge} onRaise={raise} />

              <h2>Ask for a full plan for {res.county?.name ?? "this county"}</h2>
              <p>A full plan finds every home, prices every route and tells you exactly where you stand. Counties with the most requests get planned first.</p>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn dark" onClick={requestPlan} disabled={reqState.state === "done"}>{reqState.state === "done" ? "Requested" : "Request a plan"}</button>
                {reqState.state === "done" && <span>{num(reqState.n ?? 1)} {reqState.n === 1 ? "request" : "requests"} so far for this county.</span>}
                {reqState.state === "error" && <span role="alert">Could not save right now.</span>}
                {reqState.state === "idle" && res.requests ? <span className="small">{num(res.requests)} already requested.</span> : null}
              </div>
              <p className="row" style={{ marginTop: 16 }}><Link href="/county">See what a full plan looks like in Towns County, GA</Link></p>
              <Next office={office} />
            </>
          )}

          <HomeContext slug={res.slug} home={h} lat={res.lat} lon={res.lon} />

          <h2>What the words mean</h2>
          <Glossary items={["unserved", "aerial", "buried", "wireless"]} />
        </section>
      )}
    </main>
  );
}

function RaiseHand({ county, pledge, onRaise }: { county: string; pledge: { state: string; total?: number; msg?: string }; onRaise: () => void }) {
  return (
    <div className="noprint">
      <h2>Raise your hand</h2>
      <p>One tap adds your home to your community&apos;s demand count. Providers and counties use measured demand to make the case for funding.</p>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={onRaise} disabled={pledge.state === "saving" || pledge.state === "done"}>
          {pledge.state === "done" ? "You are counted" : pledge.state === "saving" ? "Saving…" : "Raise your hand"}
        </button>
        {pledge.state === "done" && <span>{num(pledge.total ?? 0)} {pledge.total === 1 ? "home has" : "homes have"} raised a hand{county ? ` in ${county}` : ""}.</span>}
        {pledge.state === "error" && <span role="alert">{pledge.msg}</span>}
      </div>
      <p className="small" style={{ marginTop: 10 }}>Privacy: demand is only shown in aggregate over areas of many homes. No individual address is ever displayed.</p>
    </div>
  );
}

// A back-of-the-envelope route cost anyone can adjust. It is not a plan.
function Calculator({ est }: { est: Estimate }) {
  const [km, setKm] = useState(est.town ? Math.round(est.town.km * 1.3 * 10) / 10 : 5);
  const [type, setType] = useState<"aerial" | "buried">(est.polesOnRoad ? "aerial" : "buried");
  const [share, setShare] = useState(Math.max(est.homesNearby ?? 10, 1));
  const ft = km * 1000 * 3.28084;
  const rate = type === "aerial" ? 9 : 19;
  const drop = 1100 + (est.roadMeters ?? 30) * 3.28084 * 1.25 * 6;
  const perHome = (ft * rate) / Math.max(share, 1) + drop;
  return (
    <div className="box" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Rough cost to reach this address</h3>
      <p className="small">A quick calculator, not a plan. Change the numbers to see how distance, poles and sharing move the price.</p>
      <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
        <label style={{ flex: "1 1 150px" }}><span className="label">Fiber to build (km)</span>
          <input className="field" style={{ minHeight: 46, fontSize: 16 }} inputMode="decimal" value={km} onChange={(e) => setKm(Math.max(0, Number(e.target.value) || 0))} /></label>
        <label style={{ flex: "1 1 150px" }}><span className="label">Built on</span>
          <select className="field" value={type} onChange={(e) => setType(e.target.value as "aerial" | "buried")}><option value="aerial">Poles ($9 per ft)</option><option value="buried">Buried ($19 per ft)</option></select></label>
        <label style={{ flex: "1 1 150px" }}><span className="label">Homes sharing the route</span>
          <input className="field" style={{ minHeight: 46, fontSize: 16 }} inputMode="numeric" value={share} onChange={(e) => setShare(Math.max(1, Number(e.target.value) || 1))} /></label>
      </div>
      <p className="big sm" style={{ marginTop: 18 }}>{dollars(perHome)} <span className="small" style={{ fontWeight: 400 }}>per home</span></p>
    </div>
  );
}

function Next({ office, served }: { office: { name: string; href: string }; served?: boolean }) {
  return (
    <div className="noprint">
      <h2>What you can do now</h2>
      <ul style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
        <li>Contact <a href={office.href}>{office.name}</a> about funded projects near you.</li>
        <li>
          {served ? "If this listing is wrong, " : "If a provider is listed that does not actually serve you, "}
          <a href="https://www.fcc.gov/BroadbandData/consumers">file a challenge with the FCC</a>, and check <a href="https://broadbandmap.fcc.gov">the National Broadband Map</a>.
        </li>
        <li>Tell neighbors. Demand counts only work when many households raise a hand.</li>
      </ul>
    </div>
  );
}
