import Link from "next/link";
import DetectionDemo from "@/components/cv/DetectionDemo";
import HeroMap from "@/components/HeroMap";
import LiveFeed from "@/components/LiveFeed";
import Search from "@/components/Search";
import UsMap from "@/components/UsMap";
import { HomesPanel, NetworkPanel, PolesPanel, TerrainPanel, WirelessPanel } from "@/components/visuals/Panels";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>Does your home have good internet?</h1>
            <p className="lede">Enter an address and see what it would take to connect it.</p>
            <Search autoFocus />
            <p className="hint">Works for any U.S. address. Try <Link href="/home?address=200%20Lower%20Bell%20Creek%20Rd%2C%20Hiawassee%2C%20GA">200 Lower Bell Creek Rd, Hiawassee, GA</Link></p>
          </div>
          <HeroMap />
        </div>
      </section>

      <section style={{ background: "#0a1424", color: "#fff" }}>
        <div className="wrap" style={{ padding: "56px 20px 64px" }}>
          <h2 style={{ margin: "0 0 24px", color: "#fff" }}>The app looks at street photos to find utility poles</h2>
          <DetectionDemo />
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 56 }}>
        <h2 style={{ margin: "0 0 20px" }}>How a county plan gets built</h2>
        <div className="panels">
          <HomesPanel />
          <PolesPanel />
          <WirelessPanel />
          <NetworkPanel />
        </div>
        <div style={{ marginTop: 20 }}><TerrainPanel /></div>
        <div className="row" style={{ marginTop: 20 }}>
          <Link href="/county" className="btn">Open the Towns County plan</Link>
          <Link href="/street" className="btn line">Walk a street</Link>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 72 }}>
        <h2 style={{ margin: "0 0 20px" }}>Counties planned so far</h2>
        <UsMap height={460} />
        <div style={{ marginTop: 16 }}><LiveFeed /></div>
      </section>

      <section className="wrap" style={{ padding: "72px 20px 24px" }}>
        <div className="cols" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <div className="col blue"><h3>For families</h3><p>Check your address, see what it would cost to reach your home, and add your home to your community&apos;s count.</p><p style={{ marginTop: 12 }}><Link className="btn" href="/home">Check an address</Link></p></div>
          <div className="col amber"><h3>For electric co-ops, broadband offices and Congress</h3><p>Plans, costs and reports for a whole service area, district or state. There is nothing to sign up for.</p><p style={{ marginTop: 12 }}><Link className="btn line" href="/pros">Open the counties portal</Link></p></div>
        </div>
      </section>
    </main>
  );
}
