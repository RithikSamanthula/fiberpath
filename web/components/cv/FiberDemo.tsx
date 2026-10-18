"use client";
import { useEffect, useState } from "react";
import PhotoDetect from "./PhotoDetect";
import type { Box } from "@/lib/iou";

type Ex = { img: string; boxes: Box[] };

// A real street photo where the handle sweeps back and forth: today on the left, with fiber on the poles on the right
export default function FiberDemo() {
  const [ex, setEx] = useState<Ex[] | null>(null);
  const [split, setSplit] = useState(0.1);
  const [i, setI] = useState(0);
  useEffect(() => { fetch("/cv-demo/manifest.json").then((r) => (r.ok ? r.json() : null)).then(setEx).catch(() => {}); }, []);
  useEffect(() => {
    if (!ex) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setSplit(0.5 + 0.42 * Math.sin(s * 0.9));
      setI(Math.floor(s / 7) % Math.min(ex.length, 4));
    }, 50);
    return () => clearInterval(id);
  }, [ex]);
  if (!ex?.length) return null;
  const cur = ex[Math.min(i, ex.length - 1)];
  return <PhotoDetect key={i} src={cur.img} boxes={cur.boxes} stage="fiber" split={split} animate={false} ratio={0.5625} />;
}
