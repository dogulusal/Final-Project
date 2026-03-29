"use client";

import { Brain, TrendingUp, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { getAccessToken } from "@/lib/auth";

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

export default function SentimentBiasMap({ apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002", autoFetch = true }: Props) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const CIRCUMFERENCE = 2 * Math.PI * 38; // r=38 inside 100×100 viewbox

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
        // Fallback to demo data on error
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
    { key: "Pozitif", value: positiveData, color: "#22c55e", muted: "text-green-600 dark:text-green-400" },
    { key: "Nötr", value: neutralData, color: "#60a5fa", muted: "text-blue-500 dark:text-blue-400" },
    { key: "Negatif", value: negativeData, color: "#ef4444", muted: "text-red-500 dark:text-red-400" },
  ];

  const chartGradient = `conic-gradient(
    ${sentimentItems[0].color} 0 ${sentimentItems[0].value.percentage}%,
    ${sentimentItems[1].color} ${sentimentItems[0].value.percentage}% ${sentimentItems[0].value.percentage + sentimentItems[1].value.percentage}%,
    ${sentimentItems[2].color} ${sentimentItems[0].value.percentage + sentimentItems[1].value.percentage}% 100%
  )`;

  const dominantSentiment = sentimentItems.reduce((a, b) => (a.value.percentage >= b.value.percentage ? a : b));

  return (
    <div className="glass-card p-6 flex flex-col h-full relative overflow-hidden">
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
        {/* SVG Donut */}
        <div className="relative w-[96px] h-[96px] flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--bg-secondary)" strokeWidth="14" />
            {sentimentItems.map((item, idx) => {
              const dash = (item.value.percentage / 100) * CIRCUMFERENCE;
              const offset = sentimentItems
                .slice(0, idx)
                .reduce((acc, s) => acc + (s.value.percentage / 100) * CIRCUMFERENCE, 0);
              return (
                <circle
                  key={item.key}
                  cx="50" cy="50" r="38"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Baskın</span>
            <span className="text-[11px] font-bold text-[var(--text-primary)] leading-tight">{dominantSentiment.key}</span>
            <span className="text-[10px] text-[var(--text-secondary)]">%{dominantSentiment.value.percentage}</span>
          </div>
        </div>

        {/* Legend list */}
        <div className="flex-grow space-y-3.5">
          {sentimentItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className="w-full text-left group/item"
              aria-label={`${item.key} oranı`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className={`text-[11px] font-semibold ${item.muted}`}>{item.key}</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {hoveredKey === item.key
                    ? `${item.value.count} haber`
                    : `%${item.value.percentage}`}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${item.value.percentage}%`, backgroundColor: item.color }}
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
        <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 whitespace-nowrap">
          Güven %{data.confidence.average}
        </span>
      </div>
    </div>
  );
}
