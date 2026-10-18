import Glossary from "@/components/Glossary";

export const metadata = { title: "How it works — FiberPath" };

const sources = [
  ["Building footprints", "Microsoft Global ML Building Footprints", "ODbL"],
  ["Roads, poles, towers, towns", "OpenStreetMap contributors", "ODbL. © OpenStreetMap contributors"],
  ["Street photos and pole detections", "Mapillary", "CC BY-SA 4.0"],
  ["Terrain elevation", "USGS 3D Elevation Program, served as AWS Terrain Tiles", "Public domain, with attribution"],
  ["Tree canopy height", "Meta and World Resources Institute, High Resolution Canopy Height Maps", "CC BY 4.0"],
  ["Addresses and county boundaries", "U.S. Census Bureau Geocoder and TIGERweb", "Public domain"],
  ["Broadband coverage", "FCC National Broadband Map (Broadband Data Collection)", "Public data"],
];

const faq: [string, string][] = [
  ["Is my address saved?", "No. Looking up an address does not store it. If you raise your hand, only the building location is counted, and counts are shown only in aggregate over areas of many homes."],
  ["How accurate is the cost?", "It is a planning estimate from adjustable per-foot costs, good for comparing options and starting a grant application. It is not an engineering quote."],
  ["Why does my home say “modeled estimate”?", "The FCC publishes coverage data that needs a free login to download. Until it is loaded for a county, FiberPath models status and says so on screen."],
  ["Can a co-op or county use this?", "Yes. Each county plan comes with a grant report, a routes file (GeoJSON) and a homes file (CSV), and the pipeline can be run on any county."],
];

export default function About() {
  return (
    <main className="wrap page">
      <h1>How FiberPath works</h1>
      <p className="lede">FiberPath plans the cheapest way to bring high-speed internet to every home in a county, and shows each household where it stands. Everything it uses is free, public data that covers the whole country.</p>

      <h2>The six steps</h2>
      <div className="step"><span className="n">1</span><div><h3>Find every home</h3><p>Building outlines from Microsoft, filtered by size to drop sheds and barns.</p></div></div>
      <div className="step"><span className="n">2</span><div><h3>Find the poles</h3><p>Street-level photos from Mapillary show which roads have utility poles. A road with poles is priced as fiber on poles. A road without is priced as buried fiber.</p></div></div>
      <div className="step"><span className="n">3</span><div><h3>Check wireless</h3><p>From each candidate tower, the ground and tree heights are measured along the path to every home and tested against the room the signal needs, with the curve of the Earth included.</p></div></div>
      <div className="step"><span className="n">4</span><div><h3>Plan the network</h3><p>Connecting every home through the road network at minimum cost is a famously hard problem (the Steiner tree). FiberPath uses the Kou–Markowsky–Berman approximation, which is provably within 2× of the cheapest possible network and runs in seconds.</p></div></div>
      <div className="step"><span className="n">5</span><div><h3>Price every home</h3><p>A shared route is split among all the homes downstream of it, then each home adds its own connection or its share of a tower.</p></div></div>
      <div className="step"><span className="n">6</span><div><h3>Deliver</h3><p>A grant report for providers and counties, and a plain answer for each family.</p></div></div>

      <h2>The words, in plain English</h2>
      <Glossary items={["unserved", "underserved", "aerial", "buried", "wireless", "sight"]} />

      <h2>Questions</h2>
      {faq.map(([q, a]) => (<div key={q} style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}><h3 style={{ margin: 0 }}>{q}</h3><p style={{ marginTop: 6 }}>{a}</p></div>))}

      <h2>What it cannot do yet</h2>
      <ul style={{ paddingLeft: 20, display: "grid", gap: 6 }}>
        <li>Where poles are missing from the street photos, fiber is priced as buried. Photo coverage on rural roads is uneven, so costs there lean high.</li>
        <li>Line of sight uses 15 m tree cells and 30 m terrain cells. A site survey is still needed before building a tower.</li>
        <li>Full plans exist for the counties listed under County plans. Any other address gets a live estimate, not a full plan.</li>
      </ul>

      <h2 id="run">Run it for any county</h2>
      <p>For co-ops, ISPs and counties. The pipeline downloads the public data and writes a plan the website can show.</p>
      <p style={{ marginTop: 10 }}><code>python plan.py 13111</code> where the number is the five-digit county code (state + county FIPS). Set <code>MAPILLARY_TOKEN</code> for street-photo poles. Details are in the project README.</p>

      <h2 id="credits">Data credits</h2>
      <table>
        <thead><tr><th>Use</th><th>Source</th><th>License</th></tr></thead>
        <tbody>{sources.map((s) => <tr key={s[0]}><td>{s[0]}</td><td>{s[1]}</td><td>{s[2]}</td></tr>)}</tbody>
      </table>
    </main>
  );
}
