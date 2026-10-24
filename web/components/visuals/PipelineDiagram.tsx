// The six steps as one picture: public data goes in on the left, a plan comes out on the right.
const STEPS = [
  { n: "1", t: "Find homes", d: "Building outlines", icon: "homes", color: "#d64533" },
  { n: "2", t: "Find poles", d: "Street photos and a detector", icon: "pole", color: "var(--blue)" },
  { n: "3", t: "Check wireless", d: "Hills and tree height", icon: "hill", color: "var(--green)" },
  { n: "4", t: "Pick the roads", d: "Cheapest route to every home", icon: "tree", color: "#f2a900" },
  { n: "5", t: "Price it", d: "Cost for each home", icon: "tag", color: "var(--ink)" },
  { n: "6", t: "Share it", d: "Report and address lookup", icon: "doc", color: "var(--ink)" },
];

function Icon({ k, c }: { k: string; c: string }) {
  const s = { stroke: c, strokeWidth: 3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (k) {
    case "homes": return <g><path d="M14 40 L14 26 L24 18 L34 26 L34 40 Z" {...s} /><path d="M40 40 L40 30 L47 25 L54 30 L54 40" {...s} /></g>;
    case "pole": return <g><path d="M30 10 L30 52" {...s} /><path d="M18 20 L42 20 M22 28 L38 28" {...s} /><path d="M6 24 Q18 34 30 20 Q42 34 54 24" {...s} strokeWidth={2} /></g>;
    case "hill": return <g><path d="M6 46 Q18 18 30 36 Q42 14 56 46 Z" {...s} /><path d="M8 22 L52 14" {...s} strokeDasharray="4 4" /></g>;
    case "tree": return <g><circle cx="30" cy="14" r="5" {...s} /><path d="M30 19 L30 30 M30 30 L16 44 M30 30 L44 44 M30 30 L30 46" {...s} /><circle cx="16" cy="46" r="3" {...s} /><circle cx="44" cy="46" r="3" {...s} /><circle cx="30" cy="48" r="3" {...s} /></g>;
    case "tag": return <g><path d="M10 30 L30 10 L52 10 L52 32 L32 52 Z" {...s} /><circle cx="42" cy="20" r="3" {...s} /></g>;
    default: return <g><path d="M16 8 L38 8 L46 16 L46 52 L16 52 Z" {...s} /><path d="M24 26 L38 26 M24 34 L38 34 M24 42 L34 42" {...s} /></g>;
  }
}

export default function PipelineDiagram() {
  return (
    <div className="pipe" role="img" aria-label="The six steps: find homes, find poles, check wireless, pick the roads, price it, share it">
      {STEPS.map((s, i) => (
        <div className="pipe-step" key={s.n}>
          <svg viewBox="0 0 60 60" width="64" height="64" aria-hidden="true"><Icon k={s.icon} c={s.color} /></svg>
          <div><b>{s.n}. {s.t}</b><span>{s.d}</span></div>
          {i < STEPS.length - 1 && <i className="arrow" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
