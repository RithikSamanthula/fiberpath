"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Search({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/home?address=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        className="field"
        name="address"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Street address, city and state"
        aria-label="Street address"
        autoComplete="street-address"
        autoFocus={autoFocus}
      />
      <button className="btn" type="submit">Check</button>
    </form>
  );
}
