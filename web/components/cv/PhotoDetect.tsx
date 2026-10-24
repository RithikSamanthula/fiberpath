"use client";
import { useEffect, useRef } from "react";
import type { Box } from "@/lib/iou";

// A street photo with the detector's work drawn on it. Boxes appear as a scan line sweeps across the frame.
//   blue  = utility pole (counts toward "fiber on poles")
//   white = other pole, such as a street light (ignored)
//   amber = the reference labels from Mapillary, when asked for
type Props = {
  src: string;
  boxes?: Box[] | null;
  reference?: Box[] | null;
  candidates?: Box[] | null; // every box the model proposed before suppression
  stage?: "photo" | "candidates" | "final";
  scanning?: boolean;
  animate?: boolean;
  ratio?: number; // height / width
  rounded?: boolean;
};

const BLUE = "#4d8dff", WHITE = "#ffffff", AMBER = "#ffb81c";

export default function PhotoDetect({ src, boxes, reference, candidates, stage = "final", scanning, animate = true, ratio = 0.5625, rounded = true }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const raf = useRef(0);
  const t0 = useRef(0);
  const props = useRef({ boxes, reference, candidates, stage, scanning, animate });
  props.current = { boxes, reference, candidates, stage, scanning, animate };

  const draw = (now: number) => {
    const c = cv.current, im = img.current;
    if (!c || !im || !im.complete || !im.naturalWidth) return;
    const { boxes, reference, candidates, stage, scanning, animate } = props.current;
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // cover-fit the photo
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
    ctx.drawImage(im, ox, oy, dw, dh);
    if (stage !== "photo") { ctx.fillStyle = "rgba(10,20,36,0.32)"; ctx.fillRect(0, 0, W, H); }
    const X = (v: number) => ox + v * dw, Y = (v: number) => oy + v * dh;
    // sweep: boxes whose left edge the line has passed are shown
    const el = (now - t0.current) / 1000;
    const sweep = animate ? Math.min(1, el / 1.4) : 1;
    const bracket = (x: number, y: number, w: number, h: number, color: string, lw: number) => {
      const k = Math.min(14, w / 2.5, h / 2.5);
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
      ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
      ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
      ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
      ctx.stroke();
    };
    if (stage === "candidates" && candidates) {
      ctx.lineWidth = 1;
      for (const b of candidates) {
        if (b.x / 1 > sweep) continue;
        ctx.strokeStyle = (b.cls ?? 0) === 0 ? "rgba(77,141,255,0.55)" : "rgba(255,255,255,0.4)";
        ctx.strokeRect(X(b.x), Y(b.y), b.w * dw, b.h * dh);
      }
    }
    if (stage === "final") {
      for (const b of reference ?? []) {
        ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.strokeRect(X(b.x), Y(b.y), b.w * dw, b.h * dh);
        ctx.setLineDash([]);
      }
      for (const b of boxes ?? []) {
        if (b.x > sweep) continue;
        const util = (b.cls ?? 0) === 0;
        const x = X(b.x), y = Y(b.y), w = b.w * dw, h = b.h * dh;
        const age = Math.min(1, Math.max(0, (sweep - b.x) * 6));
        ctx.globalAlpha = animate ? age : 1;
        ctx.fillStyle = util ? "rgba(77,141,255,0.16)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(x, y, w, h);
        bracket(x, y, w, h, util ? BLUE : WHITE, util ? 3 : 2);
        const label = util ? `Utility pole ${Math.round((b.score ?? 0) * 100)}%` : "Street light, left out";
        ctx.font = "600 12px -apple-system, Helvetica, Arial, sans-serif";
        const tw = ctx.measureText(label).width + 12;
        const ly = y - 20 < 2 ? y + h + 2 : y - 20;
        ctx.fillStyle = util ? BLUE : "rgba(15,27,45,0.85)";
        ctx.fillRect(Math.min(x, W - tw - 2), ly, tw, 18);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, Math.min(x, W - tw - 2) + 6, ly + 13);
        ctx.globalAlpha = 1;
      }
    }
    if (scanning || (animate && sweep < 1 && stage !== "photo")) {
      const x = scanning ? ((now / 1100) % 1) * W : ox + sweep * dw;
      ctx.fillStyle = BLUE;
      ctx.fillRect(x - 1.5, 0, 3, H);
      ctx.fillStyle = "rgba(77,141,255,0.14)";
      ctx.fillRect(x - 46, 0, 46, H);
    }
  };

  useEffect(() => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => { t0.current = performance.now(); loop(); };
    im.src = src;
    img.current = im;
    const loop = () => {
      draw(performance.now());
      const p = props.current;
      const live = p.scanning || (p.animate && performance.now() - t0.current < 1700);
      if (live) raf.current = requestAnimationFrame(loop);
    };
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    t0.current = performance.now();
    cancelAnimationFrame(raf.current);
    const loop = () => {
      draw(performance.now());
      const p = props.current;
      if (p.scanning || (p.animate && performance.now() - t0.current < 1700)) raf.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, reference, candidates, stage, scanning]);

  return (
    <div ref={wrap} style={{ position: "relative", width: "100%", paddingTop: `${ratio * 100}%`, background: "#080808", borderRadius: rounded ? 3 : 0, overflow: "hidden" }}>
      <canvas ref={cv} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} role="img" aria-label="Street photo with detected utility poles outlined" />
    </div>
  );
}
