"use client";

import { useReadingHistory } from "@/hooks/useReadingHistory";
import { Lock, Radar } from "lucide-react";

export default function InterestCell() {
  const { isPersonalized, getInterests } = useReadingHistory();

  if (!isPersonalized) {
    return (
      <div className="glass-panel h-full flex items-center gap-3 px-4 py-3">
        <Lock size={16} className="text-[var(--text-muted)] flex-shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">İlgi Radarı</p>
          <p className="text-[10px] text-[var(--text-muted)]">KVKK onayı gerekli</p>
        </div>
      </div>
    );
  }

  const interests = getInterests();
  const total = Object.values(interests).reduce((a, b) => a + b, 0);

  return (
    <div className="glass-panel h-full flex items-center gap-3 px-4 py-3">
      <Radar size={16} className="text-[var(--neon-cyan)] flex-shrink-0" />
      <div>
        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">İlgi Radarı</p>
        <p className="mono text-[10px] text-[var(--text-muted)]">
          {total > 0 ? `${total} etkileşim` : "Henüz veri yok"}
        </p>
      </div>
    </div>
  );
}
