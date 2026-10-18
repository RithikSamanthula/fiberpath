"use client";
import { useEffect, useRef } from "react";
import type { County, Home } from "@/lib/data";
import { dollars } from "@/lib/cost";
import { metersPerDeg } from "@/lib/geo";

const STATUS = ["Served", "Underserved", "Unserved"];
const PATH = ["", "Fiber on poles", "Buried fiber", "Fixed wireless"];
const COL = ["", "#4d8dff", "#ffb81c", "#38c47c"];

// A picture of the result that a family can save and send to a neighbor or a county office
export default function ShareCard({ data, home }: { data: County; home: Home }) {
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const W = 1200, H = 630;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    // map half
    ctx.fillStyle = "#0f1b2d"; ctx.fillRect(0, 0, 620, H);
    const { kx, ky } = metersPerDeg(home.lat);
    const R = 1400; // meters shown each way
    const s = 310 / R;
    const X = (lon: number) => 310 + (lon - home.lon) * kx * s, Y = (lat: number) => 315 - (lat - home.lat) * ky * s;
    const near = (lon: number, lat: number) => Math.abs((lon - home.lon) * kx) < R * 1.05 && Math.abs((lat - home.lat) * ky) < R * 1.05;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 620, H); ctx.clip();
    ctx.strokeStyle = "#31435f"; ctx.lineWidth = 1.2; ctx.beginPath();
    for (const r of data.roads) for (let i = 0; i < r.length; i++) { if (!near(r[i][0], r[i][1])) continue; i ? ctx.lineTo(X(r[i][0]), Y(r[i][1])) : ctx.moveTo(X(r[i][0]), Y(r[i][1])); }
    ctx.stroke();
    for (const cls of [2, 1]) {
      ctx.strokeStyle = cls === 1 ? "#4d8dff" : "#ffb81c"; ctx.lineWidth = 4; ctx.beginPath();
      for (const e of data.plan) { if (e[4] !== cls || !near(e[0], e[1])) continue; ctx.moveTo(X(e[0]), Y(e[1])); ctx.lineTo(X(e[2]), Y(e[3])); }
      ctx.stroke();
    }
    for (const h of data.homes) {
      if (!near(h.lon, h.lat)) continue;
      ctx.fillStyle = h.status === 0 ? "#51658a" : h.tech ? COL[h.tech] : "#ff5a4a";
      ctx.beginPath(); ctx.arc(X(h.lon), Y(h.lat), 4, 0, 7); ctx.fill();
    }
    if (home.tech === 3 && home.tower >= 0) {
      const t = data.towers[home.tower];
      ctx.strokeStyle = "#38c47c"; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(X(t.lon), Y(t.lat)); ctx.lineTo(310, 315); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#38c47c"; ctx.fillRect(X(t.lon) - 8, Y(t.lat) - 8, 16, 16);
    }
    ctx.restore();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(310, 315, 16, 0, 7); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(310, 315, 5, 0, 7); ctx.fill();

    // text half
    const f = (w: number, px: number) => `${w} ${px}px -apple-system, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#0f1b2d";
    ctx.font = f(700, 26); ctx.fillText(`${data.meta.name}, ${data.meta.state}`, 670, 70);
    ctx.font = f(600, 22); ctx.fillStyle = "#5b6b84"; ctx.fillText("Internet at this address", 670, 150);
    const sc = ["#1c8c4e", "#f2a900", "#d64533"][home.status];
    ctx.fillStyle = sc; ctx.fillRect(670, 168, 14, 84);
    ctx.fillStyle = "#0f1b2d"; ctx.font = f(800, 84); ctx.fillText(STATUS[home.status], 700, 240);
    if (home.tech) {
      ctx.font = f(600, 22); ctx.fillStyle = "#5b6b84"; ctx.fillText("How it would be connected", 670, 330);
      ctx.fillStyle = "#0f1b2d"; ctx.font = f(800, 44); ctx.fillText(PATH[home.tech], 670, 382);
      ctx.font = f(600, 22); ctx.fillStyle = "#5b6b84"; ctx.fillText("Cost to connect this home", 670, 450);
      ctx.fillStyle = "#0f1b2d"; ctx.font = f(800, 64); ctx.fillText(dollars(home.cost), 670, 518);
    }
    ctx.fillStyle = "#1b5fd1"; ctx.font = f(800, 26); ctx.fillText("FiberPath", 670, 595);
    const tw = ctx.measureText("FiberPath").width;
    ctx.fillStyle = "#5b6b84"; ctx.font = f(500, 20); ctx.fillText("fiberpath.vercel.app", 670 + tw + 18, 595);
  }, [data, home]);

  return (
    <div>
      <canvas ref={cv} style={{ width: "100%", maxWidth: 720, height: "auto", display: "block", border: "1px solid var(--line)" }} role="img" aria-label="Shareable card with your result" />
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { const c = cv.current!; c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "my-internet-result.png"; a.click(); }); }}>Save as image</button>
    </div>
  );
}
