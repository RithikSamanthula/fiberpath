"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/home", "Check an address"],
  ["/county", "See a county plan"],
  ["/street", "Street view"],
  ["/live", "Live"],
];

export default function Header() {
  const path = usePathname();
  const pros = path.startsWith("/pros");
  return (
    <header className="header">
      <div className="header-in">
        <Link href="/" className="brand"><span className="mark" aria-hidden="true" />FiberPath</Link>
        <nav className="nav" aria-label="Main">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <Link href="/pros" className={`btn sm ${pros ? "" : "line"}`} style={{ marginLeft: "auto" }}>For counties and providers</Link>
      </div>
    </header>
  );
}
