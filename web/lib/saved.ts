"use client";
import { useCallback, useEffect, useState } from "react";

export type Saved = { address: string; county: string; status?: number; at: string };
const KEY = "fiberpath-saved-v1";

export function useSaved() {
  const [list, setList] = useState<Saved[]>([]);
  useEffect(() => { try { setList(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  const write = useCallback((l: Saved[]) => { setList(l); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} }, []);
  const add = useCallback((s: Saved) => write([s, ...list.filter((x) => x.address !== s.address)].slice(0, 12)), [list, write]);
  const remove = useCallback((address: string) => write(list.filter((x) => x.address !== address)), [list, write]);
  return { list, add, remove, has: (a: string) => list.some((x) => x.address === a) };
}
