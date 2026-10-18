export type Box = { x: number; y: number; w: number; h: number; score?: number; cls?: number };

export function iou(a: Box, b: Box) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return i / (a.w * a.h + b.w * b.h - i || 1);
}

// Greedy one-to-one matching at IoU >= 0.3. Poles are thin, so a loose threshold is used.
export function agreement(ours: Box[], ref: Box[], thr = 0.3) {
  const used = new Set<number>();
  let tp = 0;
  for (const o of ours) {
    let best = -1, bi = 0;
    ref.forEach((r, i) => { if (used.has(i)) return; const v = iou(o, r); if (v > bi) { bi = v; best = i; } });
    if (best >= 0 && bi >= thr) { used.add(best); tp++; }
  }
  return { tp, fp: ours.length - tp, fn: ref.length - tp };
}
