"use client";
import { useEffect, useMemo, useState } from "react";
import MapView, { Layers } from "@/components/MapView";
import Scanner from "@/components/cv/Scanner";
import { County, Home, loadCountyLite } from "@/lib/data";

const layers: Layers = { roads: true, plan: true, homes: true, towers: true, poles: true, wireless: false };

// Your address on the map, and your street as a camera saw it, with a pole detector looking at the photos.
export default function HomeContext({ slug, home, lat, lon }: { slug?: string; home?: Home | null; lat: number; lon: number }) {
  const [d, setD] = useState<County | null>(null);
  useEffect(() => { if (slug) loadCountyLite(slug).then(setD).catch(() => {}); }, [slug]);
  const link = useMemo(() => {
    if (!d || !home || home.tech !== 3 || home.tower < 0) return null;
    const t = d.towers[home.tower];
    return { a: [t.lon, t.lat] as [number, number], b: [home.lon, home.lat] as [number, number] };
  }, [d, home]);
  const pt = home ?? { lat, lon };
  return (
    <div>
      {slug && d && home && (
        <>
          <h2>Your home on the plan</h2>
          <div style={{ height: 340, display: "flex", flexDirection: "column", borderRadius: 3, overflow: "hidden" }}>
            <MapView data={d} layers={layers} selected={home} link={link} progress={1} pulse focus={{ lon: home.lon, lat: home.lat, zoom: 70000, key: home.i }} />
          </div>
          <p className="small" style={{ marginTop: 6 }}>Blue and amber lines are the planned routes. The white ring is your home. Drag to look around.</p>
        </>
      )}
      <h2>Your street, as a camera saw it</h2>
      <p className="small" style={{ marginBottom: 4 }}>Real street-level photos near this address. Press the button and FiberPath&apos;s pole detector looks for utility poles in each one.</p>
      <Scanner lat={pt.lat} lon={pt.lon} />
    </div>
  );
}
