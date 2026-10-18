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
            <h1>Find out if your home has good internet, and what it would cost to fix</h1>
            <p className="lede">FiberPath finds the homes in a county that lack fast internet, then plans the cheapest way to connect all of them. Enter an address to see your home.</p>
            <Search autoFocus />
            <p className="hint"><Link href="/tour">Watch the 90 second tour</Link>. Works for any U.S. address. Try <Link href="/home?address=200%20Lower%20Bell%20Creek%20Rd%2C%20Hiawassee%2C%20GA">200 Lower Bell Creek Rd, Hiawassee, GA</Link></p>
          </div>
          <HeroMap />
        </div>
      </section>

      <section className="wrap" style={{ padding: "40px 20px 0" }}>
        <div className="three">
          <div><b>1</b><h3>Check your address</h3><p>See if your area has fast internet, and how the nearest options compare.</p></div>
          <div><b>2</b><h3>See how it could be connected</h3><p>The plan shows if fiber on poles, buried fiber or a wireless tower fits your home, and what it costs.</p></div>
          <div><b>3</b><h3>Add your home to the count</h3><p>Counties and providers use these counts when they ask for federal funding.</p></div>
        </div>
      </section>

      <section style={{ background: "#0a1424", color: "#fff", marginTop: 40 }}>
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
