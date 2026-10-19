// Plain outline icons, one stroke weight, so every screen reads as one app
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const ICONS: Record<string, React.ReactElement> = {
  home: <g {...P}><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></g>,
  pin: <g {...P}><path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></g>,
  map: <g {...P}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></g>,
  street: <g {...P}><path d="M9 21L10.5 3M15 21L13.5 3" /><path d="M12 6v2.5M12 11.5V14M12 17v2.5" /></g>,
  live: <g {...P}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3.2" /></g>,
  work: <g {...P}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></g>,
  more: <g {...P}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></g>,
  check: <g {...P}><path d="M5 12.5l4.5 4.5L19 7.5" /></g>,
  search: <g {...P}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></g>,
  install: <g {...P}><path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14" /></g>,
  bookmark: <g {...P}><path d="M7 4h10v16l-5-4-5 4z" /></g>,
  pole: <g {...P}><path d="M12 3v18M6 7h12M8 11h8" /></g>,
};
export default function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;
}
