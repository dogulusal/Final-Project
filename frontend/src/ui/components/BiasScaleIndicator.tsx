"use client";

import { motion } from "framer-motion";

interface Props {
  sentiment: string | null;
  confidence?: number;
}

/**
 * Sentiment + Confidence değerlerine göre dinamik pozisyon hesaplar.
 * -1 (Negatif) → 0 (Nötr) → +1 (Pozitif)
 */
function sentimentToPercent(sentiment: string | null, confidence: number | null | undefined): number {
  const base = sentiment === "Pozitif" ? 75
             : sentiment === "Negatif" ? 25
             : 50; // Nötr

  // mlConfidence ile ince ayar: yüksek güven → daha uca kaydır
  const nudge = ((confidence ?? 0.5) - 0.5) * 20;
  return Math.min(95, Math.max(5, base + nudge));
}

function getSentimentChip(sentiment: string | null) {
  if (sentiment === "Pozitif") {
    return { emoji: "🟢", label: "Pozitif", color: "var(--accent-green)" };
  }
  if (sentiment === "Negatif") {
    return { emoji: "🔴", label: "Negatif", color: "var(--accent-red)" };
  }
  return { emoji: "⚪", label: "Nötr", color: "var(--text-muted)" };
}

export default function BiasScaleIndicator({ sentiment, confidence }: Props) {
  const percent = sentimentToPercent(sentiment, confidence);
  const chip = getSentimentChip(sentiment);

  return (
    <div className="flex flex-col gap-3">
      {/* Sentiment Chip */}
      <div className="flex items-center gap-2">
        <span className="text-base">{chip.emoji}</span>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: chip.color }}>
          {chip.label}
        </span>
        {confidence != null && (
          <span className="text-[10px] text-[var(--text-muted)] font-medium ml-auto">
            Güven: %{Math.round(confidence * 100)}
          </span>
        )}
      </div>
      
      {/* Scale Bar */}
      <div className="w-full flex items-center gap-3">
        <span className="text-[10px] text-[var(--accent-red)] font-bold uppercase tracking-wider w-12 text-right">Negatif</span>
        <div className="flex-grow h-2 rounded-full bg-gradient-to-r from-[var(--accent-red)] via-gray-400 to-[var(--accent-green)] relative shadow-inner">
          <motion.div 
            initial={{ left: "50%" }}
            animate={{ left: `${percent}%` }}
            transition={{ duration: 1.2, type: "spring", stiffness: 50, damping: 10 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-[var(--bg-primary)] shadow-[0_0_8px_rgba(0,0,0,0.2)] bg-[var(--text-primary)]"
          />
        </div>
        <span className="text-[10px] text-[var(--accent-green)] font-bold uppercase tracking-wider w-12">Pozitif</span>
      </div>
    </div>
  );
}
