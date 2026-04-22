"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

export default function TodayCell() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/news?status=hazir&limit=1`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.success && typeof json.totalPages === "number") {
          setCount(json.totalPages * 20);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="glass-panel h-full flex items-center justify-center">
        <div className="h-1.5 w-3/4 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-[var(--neon-purple)]/20 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel h-full flex flex-col justify-center gap-1.5 px-4 py-3">
      <span className="mono text-2xl font-bold text-[var(--text-primary)]">
        {count ?? "—"}
      </span>
      <p className="text-[11px] text-[var(--text-secondary)]">haber işlendi</p>
    </div>
  );
}
