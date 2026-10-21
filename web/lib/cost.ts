import type { Assumptions, Totals } from "./data";
import { FT, distM } from "./geo";

export function totalCost(t: Totals, a: Assumptions) {
  const fiber = t.aerialFt * a.aerialPerFt + t.buriedFt * a.buriedPerFt + t.fiberHomes * a.dropBase + t.dropFt * a.dropPerFt;
  const wireless = t.towers * a.towerEach + t.wirelessHomes * a.wirelessCpe;
  const homes = t.fiberHomes + t.wirelessHomes;
  return { fiber, wireless, total: fiber + wireless, homes, perHome: homes ? (fiber + wireless) / homes : 0 };
}

// Cost of each plan edge, used to count the total up while the routes draw.
export function edgeCosts(plan: number[][], a: Assumptions) {
  return plan.map((e) => distM(e[0], e[1], e[2], e[3]) * FT * (e[4] === 1 ? a.aerialPerFt : a.buriedPerFt));
}

export const money = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n).toLocaleString("en-US")}`;
export const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const num = (n: number) => Math.round(n).toLocaleString("en-US");

// The prices the pipeline plans with
export const STANDARD: Assumptions = { aerialPerFt: 9, buriedPerFt: 19, dropBase: 1100, dropPerFt: 6, towerEach: 200000, wirelessCpe: 700 };

// A cost is a range because street photos only show where poles exist when a car happened to drive the road.
// Low end: fiber hangs on poles along every road, as it usually does in electric co-op territory.
// High end: every road with no pole seen in the photos is priced as buried.
export function costRange(t: Totals, a: Assumptions) {
  const hi = totalCost(t, a);
  const lo = totalCost({ ...t, aerialFt: t.aerialFt + t.buriedFt, buriedFt: 0 }, a);
  return { lo, hi };
}

export function homeRange(cost: number, tech: number, dropFt: number, a: Assumptions = STANDARD): [number, number] {
  if (tech !== 2) return [cost, cost];
  const drop = a.dropBase + a.dropPerFt * dropFt;
  return [Math.min(cost, Math.max(0, cost - drop) * (a.aerialPerFt / a.buriedPerFt) + drop), cost];
}

export const range = (lo: number, hi: number, f: (n: number) => string) => (hi - lo <= Math.abs(hi) * 0.03 ? f(hi) : `${f(lo)} to ${f(hi)}`);

export const RANGE_NOTE =
  "The low end assumes fiber hangs on poles along every road, which is usual in electric co-op territory. The high end prices roads where the street photos showed no poles as buried, which costs about twice as much. Photo coverage is uneven, so no pole in the photos often just means no photos.";
