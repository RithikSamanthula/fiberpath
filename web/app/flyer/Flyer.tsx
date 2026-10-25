"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CountySelect, useCountyParam } from "@/lib/useCounty";
import { costRange, dollars, money, num, range, totalCost } from "@/lib/cost";

export default function Flyer() {
  const { slug, setSlug, index, data } = useCountyParam();
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!slug) return;
    QRCode.toString(`${location.origin}/home`, { type: "svg", margin: 0, color: { dark: "#0d0d0d", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [slug]);
  const c = data ? totalCost(data.meta.totals, data.meta.assumptions) : null;
  const t = data?.meta.totals;
  return (
    <main className="wrap page" style={{ maxWidth: 860 }}>
      <div className="row noprint" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}><CountySelect index={index} slug={slug} onChange={setSlug} /></div>
        <button className="btn" onClick={() => window.print()}>Print the flyer</button>
      </div>
      {data && c && t && (
        <div style={{ border: "4px solid #0d0d0d", padding: 36 }} className="flyer-sheet">
          <h1 style={{ fontSize: 52, lineHeight: 1.05 }}>{num(t.unserved)} homes in {data.meta.name} do not have good internet</h1>
          <p style={{ fontSize: 22, marginTop: 14 }}>A plan already exists to connect all of them, and it would cost about {range(costRange(t, data.meta.assumptions).lo.total, c.total, money)}, or {range(costRange(t, data.meta.assumptions).lo.perHome, c.perHome, dollars)} a home.</p>
          <div className="flyer-grid">
            <div>
              <p style={{ fontSize: 28, fontWeight: 800 }}>Check your address and add your home to the count</p>
              <p style={{ fontSize: 20, marginTop: 10 }}>Providers and counties use these counts to ask for funding, and adding yours takes about a minute without showing your address to anyone.</p>
              <p style={{ fontSize: 20, marginTop: 16, fontWeight: 700 }}>fiberpath.vercel.app/home</p>
            </div>
            <div style={{ width: 220, height: 220 }} dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
          <p className="small" style={{ marginTop: 24 }}>About {num(Math.round(t.unserved * 2.5))} people live in these homes, using the national average of 2.5 people per household. Plan made by FiberPath from public data.</p>
        </div>
      )}
    </main>
  );
}
