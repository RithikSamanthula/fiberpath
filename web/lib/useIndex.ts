"use client";
import { useEffect, useState } from "react";
import { IndexItem, subscribeIndex } from "./data";

export function useIndex() {
  const [idx, setIdx] = useState<IndexItem[] | null>(null);
  useEffect(() => subscribeIndex(setIdx), []);
  return idx;
}
