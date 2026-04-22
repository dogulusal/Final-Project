"use client";

import { useState, useEffect } from "react";
import { getAccessToken } from "@/lib/auth";
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

const COLORS: Record<string, string> = {
  Pozitif: "#22c55e",
  "Nötr": "#eab308",
  Negatif: "#ef4444",
};

interface SentimentDist {
  [key: string]: { count: number; percentage: number };
}

export default function SentimentCell() {
  const [data, setData] = useState<SentimentDist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${API_BASE}/api/admin/sentiment-stats`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.success && json.data?.distribution) {
          setData(json.data.distribution);
        }
      } catch {
        // silent — show fallback
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

  if (!data) {
    return (
      <div className="glass-panel h-full flex items-center justify-center">
        <span className="text-xs text-[var(--text-muted)]">—</span>
      </div>
    );
  }

  const positive = data["Pozitif"]?.percentage ?? 0;
  const neutral = data["Nötr"]?.percentage ?? 0;
  const negative = data["Negatif"]?.percentage ?? 0;

  const chartData = [
    { name: "Pozitif", value: positive },
    { name: "Nötr", value: neutral },
    { name: "Negatif", value: negative },
  ];

  const dominant = positive >= negative ? "+pozitif" : "+negatif";

  return (
    <div className="glass-panel h-full flex flex-col justify-center gap-2 px-4 py-3">
      <div className="h-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" barCategoryGap={2}>
            <XAxis type="number" hide domain={[0, 100]} />
            <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={8}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)]">
        Gündem <span className="font-semibold text-[var(--text-primary)]">{dominant}</span>
      </p>
    </div>
  );
}
