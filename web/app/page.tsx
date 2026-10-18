import Link from "next/link";
import LiveFeed from "@/components/LiveFeed";
import UsMap from "@/components/UsMap";
import HeroMap from "@/components/HeroMap";
import Glossary from "@/components/Glossary";
import PlannedList from "@/components/PlannedList";
import Search from "@/components/Search";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <div>
            <p className="label" style={{ color: "#aebad0" }}>FiberPath</p>
            <h1 style={{ marginTop: 10 }}>Does your home have real internet?</h1>
            <p className="lede">
              Type your address. In seconds you will see where your home stands, how it could be connected, and what that would cost.
            </p>
            <Search autoFocus />
            <p className="hint">Works for any address in the United States. Try <Link href="/home?address=1%20Main%20St%2C%20Hiawassee%2C%20GA">1 Main St, Hiawassee, GA</Link>.</p>
          </div>
          <HeroMap />
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 72 }}>
        <h2 style={{ marginTop: 0 }}>The money exists. The plan is the hard part.</h2>
        <p className="lede" style={{ marginTop: 0 }}>
          Federal programs send billions of dollars to states to connect rural homes. To win it, a local co-op or county has to show exactly which homes it will reach, with what, and at what cost. Today that plan comes from consultants who drive the roads and count poles by hand. Small co-ops often cannot afford that.
        </p>
        <p className="lede">FiberPath builds the plan from free public data, in minutes, for any county.</p>

        <h2>Who it is for</h2>
        <div className="cols">
          <div className="col"><h3>Families</h3><p>Check your address, see what it would cost to reach you, and add your name to the demand count.</p><p style={{ marginTop: 10 }}><Link href="/home">Check an address</Link></p></div>
          <div className="col"><h3>Co-ops and small ISPs</h3><p>Get a lowest-cost build plan with cost per home, ready to attach to a grant application.</p><p style={{ marginTop: 10 }}><Link href="/report">See a grant report</Link></p></div>
          <div className="col"><h3>County and state offices</h3><p>Compare places side by side and see where each dollar connects the most homes.</p><p style={{ marginTop: 10 }}><Link href="/compare">Compare counties</Link></p></div>
          <div className="col"><h3>Congressional offices</h3><p>See how many homes are unserved, what it would cost to close the gap, and how many neighbors are asking.</p><p style={{ marginTop: 10 }}><Link href="/explore">Explore the country</Link></p></div>
        </div>
      </section>

      <section className="band" style={{ marginTop: 72 }}>
        <div className="wrap" style={{ padding: "64px 20px" }}>
          <h2 style={{ marginTop: 0 }}>How a plan gets made</h2>
          <div className="step"><span className="n">1</span><div><h3>Find every home</h3><p>Satellite-derived building outlines show where people live, and small sheds and barns are filtered out.</p></div></div>
          <div className="step"><span className="n">2</span><div><h3>Find the utility poles</h3><p>Street-level photos reveal which roads already have poles. Fiber on poles costs far less than fiber in the ground.</p></div></div>
          <div className="step"><span className="n">3</span><div><h3>Check what wireless can reach</h3><p>Hills and trees block wireless signals that look fine on a flat map. FiberPath measures terrain and tree height along every path.</p></div></div>
          <div className="step"><span className="n">4</span><div><h3>Plan the cheapest network</h3><p>A routing algorithm picks the lowest-cost set of roads that connects every home, and prices each one.</p></div></div>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 16 }}>
        <h2>What the colors mean</h2>
        <p>The same four colors mean the same thing on every screen.</p>
        <Glossary items={["aerial", "buried", "wireless", "unserved"]} />

        <h2>Full county plans</h2>
        <p>Any address in the country can be checked. Full plans, with every route and every home priced, exist for these counties and more are on the way.</p>
        <div style={{ marginTop: 20 }}><UsMap /></div>
        <div style={{ marginTop: 16 }}><LiveFeed /></div>
        <PlannedList />
        <div className="row" style={{ marginTop: 24 }}>
          <Link href="/explore" className="btn">Explore every county</Link>
        </div>
      </section>
    </main>
  );
}
