"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import StreetExplorer from "@/components/street/StreetExplorer";
import { useIndex } from "@/lib/useIndex";

export default function StreetPage() {
  const q = useSearchParams();
  const router = useRouter();
  const index = useIndex();
  const lat = Number(q.get("lat") ?? 34.9405), lon = Number(q.get("lon") ?? -83.7433);
  const [addr, setAddr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = (la: number, lo: number) => router.push(`/street?lat=${la.toFixed(6)}&lon=${lo.toFixed(6)}`);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (addr.trim().length < 5) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/lookup?address=${encodeURIComponent(addr.trim())}`);
      const j = await r.json();
      if (!r.ok) setMsg(j.error || "No match for that address."); else go(j.lat, j.lon);
    } catch { setMsg("Could not look up that address."); }
    setBusy(false);
  }

  async function surprise() {
    if (!index?.length) return;
    setBusy(true); setMsg("Looking for a street with photos");
    for (let i = 0; i < 6; i++) {
      const c = index[Math.floor(Math.random() * index.length)];
      try {
        const r = await fetch(`/api/randomstreet?geoid=${c.geoid}&slug=${c.slug}`);
        if (r.ok) { const j = await r.json(); setMsg(`${c.name}, ${c.state}`); go(j.lat, j.lon); setBusy(false); return; }
      } catch {}
    }
    setMsg("We could not find a street with photos, so try again or search for an address.");
    setBusy(false);
  }

  function here() {
    if (!navigator.geolocation) { setMsg("Your browser cannot share its location."); return; }
    navigator.geolocation.getCurrentPosition((p) => go(p.coords.latitude, p.coords.longitude), () => setMsg("Location permission was declined."));
  }

  return (
    <main className="wrap" style={{ maxWidth: 1280, padding: "28px 20px 80px" }}>
      <h1 style={{ fontSize: 34, margin: "0 0 10px" }}>Walk a street and see its poles</h1>
      <p className="small" style={{ maxWidth: "70ch" }}>The detector looks for utility poles in every photo. Each detection gives a direction from the camera, and where directions from different photos cross, the pole is placed on the map. A pole needs at least two photos to agree.</p>

      <form onSubmit={search} className="row" style={{ marginTop: 18, gap: 8 }} role="search">
        <input className="field" style={{ flex: "1 1 320px", minHeight: 48, fontSize: 16 }} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Address, for example 1 Main St, Hiawassee, GA" aria-label="Address" />
        <button className="btn" type="submit" disabled={busy}>Go</button>
        <button className="btn line" type="button" onClick={surprise} disabled={busy || !index?.length}>Random street</button>
        <button className="btn line" type="button" onClick={here} disabled={busy}>Near me</button>
      </form>
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}

      <StreetExplorer lat={Number.isFinite(lat) ? lat : 34.9405} lon={Number.isFinite(lon) ? lon : -83.7433} onMove={go} />
    </main>
  );
}
