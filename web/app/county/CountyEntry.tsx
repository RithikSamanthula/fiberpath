"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { CountyBrowser } from "@/components/CountyPicker";
import Planner from "./Planner";

export default function CountyEntry() {
  const q = useSearchParams();
  const router = useRouter();
  if (q.get("county")) return <Planner />;
  return (
    <main className="wrap page" style={{ maxWidth: 860 }}>
      <h1>Find a county plan</h1>
      <p className="lede">Pick a county to see how every home without good internet could be connected, and what it would cost.</p>
      <div style={{ marginTop: 20 }}><CountyBrowser onPick={(s) => router.push(`/county?county=${s}`)} /></div>
    </main>
  );
}
