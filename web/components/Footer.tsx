import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap row" style={{ justifyContent: "space-between" }}>
        <span>FiberPath. Every home connected. Every dollar counted.</span>
        <span>
          Data: <Link href="/about#credits">OpenStreetMap, Microsoft, USGS, Meta and WRI, Census, Mapillary, FCC</Link>
        </span>
      </div>
    </footer>
  );
}
