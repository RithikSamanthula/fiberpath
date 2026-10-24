import Glossary from "@/components/Glossary";
import PipelineDiagram from "@/components/visuals/PipelineDiagram";
import Accuracy from "./Accuracy";

export const metadata = { title: "About - FiberPath" };

const sources = [
  ["Building outlines", "Microsoft Global ML Building Footprints", "ODbL"],
  ["Roads, poles, towers, towns", "OpenStreetMap contributors", "ODbL"],
  ["Street photos and pole labels", "Mapillary", "CC BY-SA 4.0"],
  ["Ground elevation", "USGS 3D Elevation Program, through AWS Terrain Tiles", "Public domain"],
  ["Tree height", "Meta and World Resources Institute canopy height maps", "CC BY 4.0"],
  ["Addresses and county lines", "U.S. Census Bureau geocoder and TIGERweb", "Public domain"],
  ["Broadband coverage", "FCC National Broadband Map", "Public data"],
];

const faq: [string, string][] = [
  ["Is my address saved?", "No, checking an address does not store it, and if you raise your hand only the building location is counted and the counts are only shown for areas with many homes."],
  ["How accurate are the costs?", "They are planning estimates built from per-foot prices you can change. They are good for comparing options and starting a grant application, but they are not engineering quotes."],
  ["Why does my status say \"modeled estimate\"?", "That label only appears for a county we have not matched to the FCC National Broadband Map yet, and in that case the app guesses that town centers and dense neighborhoods are served and the rest is not. Counties with real FCC data say so instead."],
  ["Can a co-op or county office use this?", "Yes, because every county plan comes with a report, a routes file and a homes file, and the planning code runs on any U.S. county."],
];

export default function About() {
  return (
    <main className="wrap page">
      <h1>About FiberPath</h1>
      <p className="lede">FiberPath plans the cheapest way to bring fast internet to every home in a county, and shows each family where they stand. It uses free public data that covers the whole country.</p>

      <h2>How a plan is made</h2>
      <PipelineDiagram />

      <h2>How well the pole finder works</h2>
      <Accuracy />

      <h2>Terms</h2>
      <Glossary items={["unserved", "underserved", "aerial", "buried", "wireless", "sight"]} />

      <h2>Questions</h2>
      {faq.map(([q, a]) => (<div key={q} style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}><h3 style={{ margin: 0 }}>{q}</h3><p style={{ marginTop: 6 }}>{a}</p></div>))}

      <h2>What it cannot do yet</h2>
      <ul style={{ paddingLeft: 20, display: "grid", gap: 6 }}>
        <li>Where the street photos show no poles, fiber is priced as buried. Photo coverage on rural roads is uneven, so costs there may run high.</li>
        <li>Wireless checks use 30 meter ground cells and 30 meter tree cells, so a real site visit is still needed before a tower goes up.</li>
        <li>Counties without a full plan get a quick estimate for the address instead.</li>
      </ul>

      <h2 id="run">Run it for any county</h2>
      <p>The planning code downloads the public data and writes a plan the website can show. Give it a five digit county code, for example <code>python plan.py 13111</code>. Set <code>MAPILLARY_TOKEN</code> to use street photos for poles. The README has the details.</p>

      <h2 id="credits">Data sources</h2>
      <table>
        <thead><tr><th>Used for</th><th>Source</th><th>License</th></tr></thead>
        <tbody>{sources.map((s) => <tr key={s[0]}><td>{s[0]}</td><td>{s[1]}</td><td>{s[2]}</td></tr>)}</tbody>
      </table>
    </main>
  );
}
