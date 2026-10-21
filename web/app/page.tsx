import Link from "next/link";
import DetectionDemo from "@/components/cv/DetectionDemo";
import HeroMap from "@/components/HeroMap";
import Icon from "@/components/Icons";
import { DetectorFacts, LiveStats, SavedPlaces } from "@/components/HomeWidgets";
import LiveFeed from "@/components/LiveFeed";
import Search from "@/components/Search";
import UsMap from "@/components/UsMap";
import { HomesPanel, NetworkPanel, PolesPanel, TerrainPanel, WirelessPanel } from "@/components/visuals/Panels";

const ACTIONS: [string, string, string, string, string][] = [
  ["/home", "Check my address", "Is my home connected, who offers service, what a fix would cost", "pin", ""],
  ["/street", "Walk my street", "A 3D street view with the utility poles marked", "street", "amber"],
  ["/live", "Camera pole finder", "Point your phone at a road and the poles light up", "live", "green"],
  ["/county", "County plans", "The cheapest way to connect every home in a county", "map", "ink"],
];

export default function Home() {
  return (
    <main className="ah">
      <section className="ah-top">
        <div className="ah-card">
          <h1>Is your home connected?</h1>
          <p className="lede">Check any U.S. address for fast internet. FiberPath plans the cheapest way to reach the homes that are left.</p>
          <Search autoFocus />
          <p className="hint" style={{ color: "#aebad0", marginTop: 12, fontSize: 14 }}>Try <Link style={{ color: "#fff" }} href="/home?address=6333%20US%20Hwy%2076%2C%20Hiawassee%2C%20GA">6333 US Hwy 76, Hiawassee, GA</Link> or <Link style={{ color: "#fff" }} href="/tour">watch the 90 second tour</Link></p>
        </div>
        <div className="ah-map"><HeroMap /></div>
      </section>

      <LiveStats />

      <section className="ah-actions" aria-label="What you can do">
        {ACTIONS.map(([href, title, text, icon, tone]) => (
          <Link key={href} href={href} className={`ah-act ${tone}`}>
            <span className="ic"><Icon name={icon} size={26} /></span>
            <b>{title}</b>
            <span>{text}</span>
          </Link>
        ))}
      </section>

      <section className="ah-row">
        <SavedPlaces />
        <div><h2>Just finished</h2><LiveFeed count={5} /></div>
      </section>

      <section>
        <h2>Counties planned so far</h2>
        <UsMap height={440} />
      </section>

      <section style={{ background: "#0a1424", color: "#fff", borderRadius: 16, padding: "32px 24px" }}>
        <h2 style={{ color: "#fff" }}>The detector reads street photos to find utility poles</h2>
        <DetectionDemo />
        <div style={{ marginTop: 20, color: "var(--ink)" }}><DetectorFacts /></div>
      </section>

      <section>
        <h2>How a county plan gets built</h2>
        <div className="panels">
          <HomesPanel />
          <PolesPanel />
          <WirelessPanel />
          <NetworkPanel />
        </div>
        <div style={{ marginTop: 20 }}><TerrainPanel /></div>
      </section>
    </main>
  );
}
