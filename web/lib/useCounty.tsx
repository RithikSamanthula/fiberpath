"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { County, IndexItem, ensureGrids, loadCountyLite } from "./data";
import { useIndex } from "./useIndex";

export function useCountyParam() {
  const q = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const index = useIndex();
  const [data, setData] = useState<County | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slug = q.get("county") ?? index?.find((i) => i.slug === "towns-ga")?.slug ?? index?.[0]?.slug ?? null;

  useEffect(() => {
    if (!slug) return;
    let live = true;
    setData(null);
    setError(null);
    loadCountyLite(slug).then((d) => {
      if (!live) return;
      setData(d);
      if (!d.hasGrids) ensureGrids(d).then((g) => live && setData({ ...g })).catch(() => {});
    }).catch((e) => live && setError(String(e.message || e)));
    return () => { live = false; };
  }, [slug]);

  const setSlug = useCallback((s: string) => {
    const p = new URLSearchParams(q.toString());
    p.set("county", s);
    router.replace(`${path}?${p.toString()}`);
  }, [q, router, path]);

  return { slug, setSlug, index, data, error };
}

export { CountyButton as CountySelect } from "@/components/CountyPicker";
