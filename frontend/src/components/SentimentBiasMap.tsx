"use client";

import { Brain, TrendingUp, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/auth";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface Props {
  apiUrl?: string;
  autoFetch?: boolean;
}

interface SentimentData {
  distribution: {
    [key: string]: { count: number; percentage: number }
  };
  confidence: {
    average: number;
    min: number;
    max: number;
  };
  totalArticles: number;
}

const COLORS: Record<string, string> = {
  Pozitif: "#22c55e",
  "Nötr": "#eab308",
  Negatif: "#ef4444",
};

const MUTED: Record<string, string> = {
  Pozitif: "text-green-600 dark:text-green-400",
  "Nötr": "text-yellow-600 dark:text-yellow-400",
  Negatif: "text-red-500 dark:text-red-400",
};

export default function SentimentBiasMap({ apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002", autoFetch = true }: Props) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    if (!autoFetch) return;

    const fetchSentimentData = async () => {
      try {
        const token = getAccessToken();
        const response = await fetch(`${apiUrl}/api/admin/sentiment-stats`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('[SentimentBiasMap] Fetch error:', err);
        setData({
          distribution: {
            'Pozitif': { count: 45, percentage: 45 },
            'Nötr': { count: 35, percentage: 35 },
            'Negatif': { count: 20, percentage: 20 }
          },
          confidence: { average: 86, min: 65, max: 98 },
          totalArticles: 100
        });
        setError('Demo verisi gösteriliyor');
      } finally {
        setLoading(false);
      }
    };

    fetchSentimentData();
  }, [apiUrl, autoFetch]);

  const onPieEnter = useCallback((_: unknown, index: number) => setActiveIndex(index), []);
  const onPieLeave = useCallback(() => setActiveIndex(-1), []);

  if (loading) {
    return (
      <div className="p-6 glass-card border-[var(--border-subtle)] overflow-hidden h-full flex flex-col justify-center">
        <div className="text-center py-6">
          <p className="text-sm text-[var(--text-muted)] font-medium">Duygu analizi yükleniyor...</p>
          <div className="h-1.5 w-3/4 bg-[var(--bg-secondary)] rounded-full mx-auto mt-4 overflow-hidden relative">
            <div className="absolute inset-0 skeleton-premium opacity-50"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 glass-card border-[var(--border-subtle)]">
        <div className="text-center text-[var(--text-muted)]">
          <AlertCircle className="mx-auto mb-2 text-amber-500" />
          <p className="text-sm">Veri yüklenemedi</p>
        </div>
      </div>
    );
  }

  const positiveData = data.distribution['Pozitif'] || { count: 0, percentage: 0 };
  const neutralData = data.distribution['Nötr'] || { count: 0, percentage: 0 };
  const negativeData = data.distribution['Negatif'] || { count: 0, percentage: 0 };

  const sentimentItems = [
    { name: "Pozitif", value: positiveData.percentage, count: positiveData.count, fill: COLORS.Pozitif },
    { name: "Nötr", value: neutralData.percentage, count: neutralData.count, fill: COLORS["Nötr"] },
    { name: "Negatif", value: negativeData.percentage, count: negativeData.count, fill: COLORS.Negatif },
  ];

  const dominantSentiment = sentimentItems.reduce((a, b) => (a.value >= b.value ? a : b));

  return (
    <div className="glass-panel flex flex-col h-full relative overflow-hidden">
      <div className="flex items-center gap-2 mb-5">
        <Brain className="text-[var(--accent-warm)]" size={18} />
        <h3 className="font-bold text-[var(--text-primary)] tracking-wide">Gündem Duygu Haritası</h3>
        {error && (
          <span className="text-[10px] text-amber-500 ml-auto border border-amber-400/30 rounded-full px-2 py-0.5 bg-amber-50">
            {error}
          </span>
        )}
      </div>

      {/* Donut + list */}
      <div className="flex items-center gap-5 flex-grow">
        {/* Recharts Donut */}
        <div className="relative w-[110px] h-[110px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sentimentItems}
                cx="50%"
                cy="50%"
                innerRadius={34}
                outerRadius={48}
                paddingAngle={2}
                strokeWidth={0}
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {sentimentItems.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Baskın</span>
            <span className="text-[11px] font-bold text-[var(--text-primary)] leading-tight">{dominantSentiment.name}</span>
            <span className="mono text-[10px] text-[var(--text-secondary)]">%{dominantSentiment.value}</span>
          </div>
        </div>

        {/* Legend list */}
        <div className="flex-grow space-y-3.5">
          {sentimentItems.map((item, idx) => (
            <button
              key={item.name}
              type="button"
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(-1)}
              className="w-full text-left group/item"
              aria-label={`${item.name} oranı`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className={`text-[11px] font-semibold ${MUTED[item.name]}`}>{item.name}</span>
                </div>
                <span className="mono text-[11px] text-[var(--text-muted)]">
                  {activeIndex === idx
                    ? `${item.count} haber`
                    : `%${item.value}`}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${item.value}%`, backgroundColor: item.fill }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp size={12} className="flex-shrink-0 text-[var(--accent-warm)]" />
          <p className="text-[11px] text-[var(--text-secondary)] truncate">
            Gündem{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {positiveData.percentage > negativeData.percentage ? "daha pozitif" : "daha negatif"}
            </span>
            {" "}yönelimde
          </p>
        </div>
        <span className="mono text-[10px] text-[var(--text-muted)] flex-shrink-0 whitespace-nowrap">
          Güven %{data.confidence.average}
        </span>
      </div>
    </div>
  );
}
