"use client";
import LiveView from "@/components/live/LiveView";

export default function LivePage() {
  return (
    <main className="wrap" style={{ maxWidth: 1280, padding: "28px 20px 80px" }}>
      <h1 style={{ fontSize: 34, margin: "0 0 10px" }}>Find poles with your phone</h1>
      <p className="small" style={{ maxWidth: "70ch" }}>Point your camera down a road. The detector marks utility poles as you move, and the map shows where they stand around you. No camera? Watch a recorded drive instead.</p>
      <LiveView startLat={34.9405} startLon={-83.7433} />
    </main>
  );
}
