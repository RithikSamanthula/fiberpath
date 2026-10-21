"use client";
import { useCallback, useEffect, useState } from "react";
import type { Assumptions } from "./data";

export type Role = "coop" | "office" | "congress";
export type Workspace = {
  role: Role | null;
  name: string; // what the workspace is called, for example "Blue Ridge EMC" or "GA-09"
  geoids: string[]; // the counties in this workspace
  prices: Assumptions | null; // the user's own unit costs, if they changed them
  note?: string; // a line about how the area was chosen, shown on the dashboard
};

const KEY = "fiberpath-workspace-v1";
const EMPTY: Workspace = { role: null, name: "", geoids: [], prices: null, note: "" };

// Saved in this browser only. There is no account and nothing is sent anywhere.
export function useWorkspace() {
  const [ws, setWs] = useState<Workspace>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setWs({ ...EMPTY, ...JSON.parse(raw) }); } catch {}
    setReady(true);
  }, []);
  const save = useCallback((next: Workspace) => {
    setWs(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }, []);
  const update = useCallback((patch: Partial<Workspace>) => save({ ...ws, ...patch }), [ws, save]);
  const reset = useCallback(() => save(EMPTY), [save]);
  return { ws, ready, update, reset, save };
}
