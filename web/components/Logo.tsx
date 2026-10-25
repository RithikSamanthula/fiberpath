export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" fill="#111111" />
      <path d="M10 26V7h14M10 16h11" fill="none" stroke="#ffffff" strokeWidth="4.4" />
    </svg>
  );
}

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">FiberPath</span>
    </span>
  );
}
