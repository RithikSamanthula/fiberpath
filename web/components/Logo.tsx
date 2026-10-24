// The mark is one fiber run: it leaves a node, turns twice along a road, and ends at a home
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="#1b5fd1" />
      <path d="M9 22.5H16V11.5H22" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="22.5" r="2.4" fill="#fff" />
      <circle cx="23" cy="11.5" r="3.2" fill="#f2a900" />
    </svg>
  );
}

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Fiber<b>Path</b></span>
    </span>
  );
}
