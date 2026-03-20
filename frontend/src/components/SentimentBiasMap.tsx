"use client";

import { Brain, TrendingUp, AlertCircle } from "lucide-react";

interface Props {
  positiveCount?: number;
  negativeCount?: number;
  neutralCount?: number;
}

export default function SentimentBiasMap({ positiveCount = 45, negativeCount = 20, neutralCount = 35 }: Props) {
  const total = positiveCount + negativeCount + neutralCount; // Calculate total without || 1 for the check
  const safeStats = positiveCount !== undefined && negativeCount !== undefined && neutralCount !== undefined;

  if (!safeStats || total === 0) {
    return (
      <div className="p-6 glass-card border-[var(--border-subtle)] overflow-hidden h-full flex flex-col justify-center">
        <div className="text-center py-6">
          <p className="text-sm text-[var(--text-muted)] font-medium">Gündem verisi analiz ediliyor...</p>
          <div className="h-1.5 w-3/4 bg-[var(--bg-secondary)] rounded-full mx-auto mt-4 overflow-hidden relative">
            <div className="absolute inset-0 skeleton-premium opacity-50"></div>
          </div>
        </div>
      </div>
    );
  }

  // Recalculate total with || 1 for percentage calculation if needed, or ensure it's not zero
  const calculatedTotal = total || 1;
  const posPct = Math.round((positiveCount / calculatedTotal) * 100);
  const negPct = Math.round((negativeCount / calculatedTotal) * 100);
  const neuPct = Math.round((neutralCount / calculatedTotal) * 100);

  return (
    <div className="glass-card p-6 flex flex-col h-full relative overflow-hidden group">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="text-[var(--accent-blue)]" size={20} />
        <h3 className="font-bold text-[var(--text-primary)] tracking-wide">Gündem Duygu Haritası</h3>
      </div>

      <div className="flex flex-col gap-4 flex-grow justify-center">
        {/* Pozitif */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-green-600 dark:text-green-400">Pozitif ({posPct}%)</span>
            <span className="text-[var(--text-muted)]">{positiveCount} haber</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5 overflow-hidden">
            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${posPct}%` }}></div>
          </div>
        </div>

        {/* Nötr */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-500 dark:text-blue-400">Nötr ({neuPct}%)</span>
            <span className="text-[var(--text-muted)]">{neutralCount} haber</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5 overflow-hidden">
            <div className="bg-blue-400 h-2.5 rounded-full transition-all duration-1000 ease-out delay-150" style={{ width: `${neuPct}%` }}></div>
          </div>
        </div>

        {/* Negatif */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-red-500 dark:text-red-400">Negatif ({negPct}%)</span>
            <span className="text-[var(--text-muted)]">{negativeCount} haber</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5 overflow-hidden">
            <div className="bg-red-500 h-2.5 rounded-full transition-all duration-1000 ease-out delay-300" style={{ width: `${negPct}%` }}></div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-start gap-2 text-[11px] text-[var(--text-muted)] leading-relaxed">
        <TrendingUp size={14} className="flex-shrink-0 mt-0.5 text-[var(--accent-warm)]" />
        <p>
          AI sözlük analizi, bugün genel gündem dilinin ortalamadan <span className="font-bold text-[var(--text-primary)]">daha pozitif</span> olduğunu tespit etti.
        </p>
      </div>
    </div>
  );
}
