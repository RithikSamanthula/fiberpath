"use client";
import { useEffect, useState } from "react";

export function useLoop(seconds: number, hold = [0.8, 3.5], enabled = true) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setP(1); return; }
    const t0 = performance.now();
    const id = setInterval(() => {
      if (document.hidden) return;
      const c = ((performance.now() - t0) / 1000) % (seconds + hold[0] + hold[1]);
      setP(c < hold[0] ? 0 : c < hold[0] + seconds ? (c - hold[0]) / seconds : 1);
    }, 66);
    return () => clearInterval(id);
  }, [seconds, hold, enabled]);
  return p;
}
