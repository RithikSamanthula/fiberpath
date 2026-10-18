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
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n).toLocaleString("en-US")}`;
export const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const num = (n: number) => Math.round(n).toLocaleString("en-US");
