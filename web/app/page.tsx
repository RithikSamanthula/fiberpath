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
            <p className="label" style={{ color: "#aebad0" }}>FiberPath</p>
            <h1 style={{ marginTop: 10 }}>Does your home have real internet?</h1>
            <p className="lede">Type an address. See where it stands and what it would cost to connect.</p>
            <Search autoFocus />
            <p className="hint">Any address in the United States. Try <Link href="/home?address=200%20Lower%20Bell%20Creek%20Rd%2C%20Hiawassee%2C%20GA">200 Lower Bell Creek Rd, Hiawassee, GA</Link>.</p>
          </div>
          <HeroMap />
        </div>
      </section>

      <section style={{ background: "#0a1424", color: "#fff" }}>
        <div className="wrap" style={{ padding: "56px 20px 64px" }}>
          <p className="label" style={{ color: "#8fa3c4" }}>Computer vision</p>
          <h2 style={{ margin: "8px 0 24px", color: "#fff" }}>It reads the street photos to find the poles.</h2>
          <DetectionDemo />
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 56 }}>
        <p className="label">From photos to a plan</p>
        <h2 style={{ margin: "8px 0 20px" }}>Real data. Real county. Every panel is live.</h2>
        <div className="panels">
          <HomesPanel />
          <PolesPanel />
          <WirelessPanel />
          <NetworkPanel />
        </div>
        <div style={{ marginTop: 20 }}><TerrainPanel /></div>
        <div className="row" style={{ marginTop: 20 }}>
          <Link href="/county" className="btn">Open the full county plan</Link>
          <Link href="/report" className="btn line">Grant report</Link>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 72 }}>
        <p className="label">Every county</p>
        <h2 style={{ margin: "8px 0 20px" }}>Planning the whole country, live.</h2>
        <UsMap height={460} />
        <div style={{ marginTop: 16 }}><LiveFeed /></div>
      </section>

      <section className="wrap" style={{ padding: "72px 20px 24px" }}>
        <div className="cols">
          <div className="col"><h3>Families</h3><p><Link href="/home">Check an address</Link></p></div>
          <div className="col"><h3>Co-ops and ISPs</h3><p><Link href="/report">Get a grant-ready plan</Link></p></div>
          <div className="col"><h3>Counties and states</h3><p><Link href="/compare">Compare counties</Link></p></div>
          <div className="col"><h3>Congress</h3><p><Link href="/explore">Explore the country</Link></p></div>
        </div>
      </section>
    </main>
  );
}
