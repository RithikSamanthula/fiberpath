"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { County, IndexItem, loadCounty } from "./data";
import { useIndex } from "./useIndex";

// The county shown on a screen comes from ?county=<slug>, so every view can be linked.
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
    loadCounty(slug).then((d) => live && setData(d)).catch((e) => live && setError(String(e.message || e)));
    return () => { live = false; };
  }, [slug]);

  const setSlug = useCallback((s: string) => {
    const p = new URLSearchParams(q.toString());
    p.set("county", s);
    router.replace(`${path}?${p.toString()}`);
  }, [q, router, path]);

  return { slug, setSlug, index, data, error };
}

export function CountySelect({ index, slug, onChange }: { index: IndexItem[] | null; slug: string | null; onChange: (s: string) => void }) {
  if (!index || !slug) return null;
  return (
    <select className="field" value={slug} onChange={(e) => onChange(e.target.value)} aria-label="County">
      {index.map((i) => <option key={i.slug} value={i.slug}>{i.name}, {i.state}</option>)}
    </select>
  );
}
