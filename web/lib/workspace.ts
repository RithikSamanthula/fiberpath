"use client";
import { useCallback, useEffect, useState } from "react";
import type { Assumptions } from "./data";

export type Role = "coop" | "office" | "congress";
export type Workspace = {
  role: Role | null;
  name: string;
  geoids: string[];
  prices: Assumptions | null;
  note?: string;
};

const KEY = "fiberpath-workspace-v1";
const EMPTY: Workspace = { role: null, name: "", geoids: [], prices: null, note: "" };

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
