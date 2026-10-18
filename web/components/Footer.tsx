import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap row" style={{ justifyContent: "space-between" }}>
        <span>FiberPath, a Congressional App Challenge entry. <Link href="/about">About</Link> · <Link href="/explore">Explore the country</Link> · <Link href="/pros">For counties and providers</Link></span>
        <span>
          Data sources: <Link href="/about#credits">OpenStreetMap, Microsoft, USGS, Meta, Census, Mapillary</Link>
        </span>
      </div>
    </footer>
  );
}
