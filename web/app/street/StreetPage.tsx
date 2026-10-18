"use client";
import { useSearchParams } from "next/navigation";
import StreetExplorer from "@/components/street/StreetExplorer";
import Search from "@/components/Search";

export default function StreetPage() {
  const q = useSearchParams();
  const lat = Number(q.get("lat") ?? 34.9405), lon = Number(q.get("lon") ?? -83.7433);
  return (
    <main className="wrap" style={{ maxWidth: 1280, padding: "28px 20px 80px" }}>
      <p className="label">Street view</p>
      <h1 style={{ fontSize: 34, margin: "6px 0 10px" }}>Walk the street. Watch the poles get found and placed.</h1>
      <p className="small" style={{ maxWidth: "70ch" }}>Each photo is read by the pole detector. Every detection is a bearing from the camera; where bearings from different photos cross, a pole is placed. A pole is only shown when at least three photos agree.</p>
      <StreetExplorer lat={Number.isFinite(lat) ? lat : 34.9405} lon={Number.isFinite(lon) ? lon : -83.7433} />
    </main>
  );
}
