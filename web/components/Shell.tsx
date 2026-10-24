"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icons";
import Logo, { LogoMark } from "./Logo";

const TABS: [string, string, string][] = [
  ["/", "Home", "home"],
  ["/home", "Address", "pin"],
  ["/county", "Plans", "map"],
  ["/street", "Street", "street"],
  ["/live", "Camera", "live"],
  ["/pros", "Workspace", "work"],
];
const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

// The frame around every screen: an icon rail on a computer, a tab bar on a phone, installable like any other app
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [prompt, setPrompt] = useState<any>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const bip = (e: Event) => { e.preventDefault(); setPrompt(e); };
    const on = () => setOnline(true), off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("beforeinstallprompt", bip);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("beforeinstallprompt", bip); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <div className="shell">
      <nav className="rail noprint" aria-label="Main">
        <Link href="/" className="rail-brand" aria-label="FiberPath home"><Logo size={34} /></Link>
        {TABS.map(([href, label, icon]) => (
          <Link key={href} href={href} className="rail-tab" aria-current={active(path, href) ? "page" : undefined}>
            <span className="ti"><Icon name={icon} size={20} /></span><span className="tl">{label}</span>
          </Link>
        ))}
        <span className="rail-gap" />
        {prompt && <button className="rail-tab install" onClick={() => { prompt.prompt(); setPrompt(null); }}><span className="ti"><Icon name="install" size={20} /></span><span className="tl">Install the app</span></button>}
        <Link href="/about" className="rail-tab more" aria-current={active(path, "/about") ? "page" : undefined}><span className="ti"><Icon name="more" size={20} /></span><span className="tl">About</span></Link>
      </nav>
      <div className="shell-main">
        {!online && <div className="offline" role="status">You are offline. Pages you opened before still work.</div>}
        {children}
      </div>
    </div>
  );
}
