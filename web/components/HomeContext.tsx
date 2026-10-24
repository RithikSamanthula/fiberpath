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
  const [noPhotos, setNoPhotos] = useState(false);
  return (
    <div className={slug && home && !noPhotos ? "hh-visuals" : ""} style={{ marginTop: 20 }}>
      {slug && home && (
        <div style={{ minHeight: noPhotos ? 440 : 360, display: "flex", flexDirection: "column", borderRadius: 0, overflow: "hidden", position: "relative", background: "#0f1b2d" }}>
          {d ? <MapView data={d} layers={layers} selected={home} link={link} progress={1} pulse satellite focus={{ lon: home.lon, lat: home.lat, zoom: 22000, key: home.i }} /> : <span style={{ margin: "auto", color: "#aebad0" }}>Loading the plan</span>}
          <span className="label" style={{ position: "absolute", left: 10, top: 10, background: "var(--card)", padding: "4px 8px" }}>Your home on the plan</span>
        </div>
      )}
      <div>
        <Scanner lat={pt.lat} lon={pt.lon} onEmpty={setNoPhotos} />
      </div>
    </div>
  );
}
