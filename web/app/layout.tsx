import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "FiberPath",
  description: "Check whether your home has good internet and see the cheapest plan to connect every home in your county",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FiberPath", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f1b2d", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
