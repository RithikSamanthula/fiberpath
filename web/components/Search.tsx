"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Search({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const typed = useRef(false);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus && window.matchMedia("(pointer: fine)").matches) inp.current?.focus(); }, [autoFocus]);

  useEffect(() => {
    if (!typed.current) return;
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => { setItems(j.items ?? []); setSel(-1); setOpen(true); }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (v: string) => { setOpen(false); if (v.trim()) router.push(`/home?address=${encodeURIComponent(v.trim())}`); };

  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); go(sel >= 0 ? items[sel] : q); }} style={{ position: "relative" }}>
      <input
        ref={inp}
        className="field"
        name="address"
        value={q}
        onChange={(e) => { typed.current = true; setQ(e.target.value); }}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % items.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s <= 0 ? items.length - 1 : s - 1)); }
          else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => items.length && setOpen(true)}
        placeholder="Enter your address"
        aria-label="Street address"
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="search"
        inputMode="text"
      />
      <button className="btn" type="submit">Check</button>
      {open && items.length > 0 && (
        <ul role="listbox" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, margin: "4px 0 0", padding: 0, listStyle: "none", background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 6px 18px rgba(15,27,45,0.18)" }}>
          {items.map((s, i) => (
            <li key={s} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); setQ(s); typed.current = false; go(s); }} onMouseEnter={() => setSel(i)}
              style={{ padding: "11px 14px", cursor: "pointer", fontSize: 16, background: i === sel ? "#e8f0fd" : "#fff", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0, color: "var(--ink)" }}>{s}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
