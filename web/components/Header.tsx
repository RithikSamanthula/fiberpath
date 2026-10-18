"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/home", "Check an address"],
  ["/county", "County plans"],
  ["/explore", "Explore the U.S."],
  ["/compare", "Compare"],
  ["/report", "Grant report"],
  ["/about", "How it works"],
];

export default function Header() {
  const path = usePathname();
  return (
    <header className="header">
      <div className="header-in">
        <Link href="/" className="brand"><span className="mark" aria-hidden="true" />FiberPath</Link>
        <nav className="nav" aria-label="Main">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
