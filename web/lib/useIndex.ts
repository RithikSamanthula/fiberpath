"use client";
import { useEffect, useState } from "react";
import { IndexItem, subscribeIndex } from "./data";

// The live list of planned counties. Updates by itself as the pipeline finishes more.
export function useIndex() {
  const [idx, setIdx] = useState<IndexItem[] | null>(null);
  useEffect(() => subscribeIndex(setIdx), []);
  return idx;
}
