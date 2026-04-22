"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface MLStatus {
  accuracy: number;
  model_type: string;
  trained_at: string;
  sample_count: number;
}

export default function ModelCell() {
  const [data, setData] = useState<MLStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ml/status`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
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
          <div className="h-full w-1/2 bg-[var(--neon-cyan)]/20 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-panel h-full flex items-center justify-center">
        <span className="text-xs text-[var(--text-muted)]">Model yükleniyor...</span>
      </div>
    );
  }

  const accuracy = data.accuracy;
  const version = data.model_type?.includes("v") ? data.model_type : `v${data.sample_count ? Math.floor(data.sample_count / 100) : "?"}`;

  return (
    <div className="glass-panel h-full flex flex-col justify-center gap-1.5 px-4 py-3">
      <span className="mono text-2xl font-bold text-[var(--text-primary)]">
        %{accuracy.toFixed(1)}
      </span>
      <p className="text-[11px] text-[var(--text-secondary)]">
        Combined Acc · {version}
      </p>
      <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden mt-1">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${Math.min(accuracy, 100)}%`,
            background: "linear-gradient(90deg, var(--neon-purple), var(--neon-cyan))",
          }}
        />
      </div>
    </div>
  );
}
