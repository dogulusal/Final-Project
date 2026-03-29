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

export default function SentimentBiasMap({ apiUrl = "http://localhost:3001", autoFetch = true }: Props) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="glass-card p-6 flex flex-col h-full relative overflow-hidden group">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="text-[var(--accent-blue)]" size={20} />
        <h3 className="font-bold text-[var(--text-primary)] tracking-wide">Gündem Duygu Haritası</h3>
        {error && <span className="text-xs text-amber-500 ml-auto">{error}</span>}
      </div>

      <div className="flex flex-col gap-4 flex-grow justify-center">
        {/* Pozitif */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-green-600 dark:text-green-400">Pozitif ({positiveData.percentage}%)</span>
            <span className="text-[var(--text-muted)]">{positiveData.count} haber</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5 overflow-hidden">
            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${positiveData.percentage}%` }}></div>
          </div>
        </div>

        {/* Nötr */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-500 dark:text-blue-400">Nötr ({neutralData.percentage}%)</span>
            <span className="text-[var(--text-muted)]">{neutralData.count} haber</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5 overflow-hidden">
            <div className="bg-blue-400 h-2.5 rounded-full transition-all duration-1000 ease-out delay-150" style={{ width: `${neutralData.percentage}%` }}></div>
          </div>
        </div>

        {/* Negatif */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-red-500 dark:text-red-400">Negatif ({negativeData.percentage}%)</span>
            <span className="text-[var(--text-muted)]">{negativeData.count} haber</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5 overflow-hidden">
            <div className="bg-red-500 h-2.5 rounded-full transition-all duration-1000 ease-out delay-300" style={{ width: `${negativeData.percentage}%` }}></div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-3">
          <div className="flex items-center gap-2">
            <span>Güven Skoru: <span className="font-bold text-[var(--text-primary)]">%{data.confidence.average}</span></span>
            <span className="text-[var(--text-secondary)]">(Min: %{data.confidence.min}, Max: %{data.confidence.max})</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <TrendingUp size={14} className="flex-shrink-0 mt-0.5 text-[var(--accent-warm)]" />
          <p>
            {positiveData.percentage > negativeData.percentage 
              ? `Gündem dilinin ortalamadan <span class="font-bold text-[var(--text-primary)]">daha pozitif</span> olduğu tespit edildi.`
              : `Gündem dilinin ortalamadan <span class="font-bold text-[var(--text-primary)]">daha negatif</span> olduğu tespit edildi.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
