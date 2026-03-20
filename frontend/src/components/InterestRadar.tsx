"use client";

import { useReadingHistory } from "@/hooks/useReadingHistory";
import { Radar, Compass } from "lucide-react";
import { useMemo } from "react";

export default function InterestRadar() {
  const { getInterests, isPersonalized } = useReadingHistory();

  const interests = useMemo(() => {
    const raw = getInterests() as Record<string, number>;
    const categories = Object.keys(raw);
    if (!categories.length) return [];
    
    // Basit bir bubble/bar representation
    const maxScore = Math.max(...Object.values(raw).map(val => Number(val)));
    
    return categories.map(cat => ({
      name: cat,
      score: Number(raw[cat]),
      pct: Math.round((Number(raw[cat]) / maxScore) * 100)
    })).sort((a,b) => b.score - a.score).slice(0, 5); // top 5
  }, [getInterests()]); // trigger re-render on interest change if possible

  if (!isPersonalized || interests.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center h-full text-center min-h-[250px] relative overflow-hidden group">
        <Radar size={48} className="text-[var(--text-muted)] opacity-30 mb-4" />
        <h3 className="font-bold text-[var(--text-primary)] mb-2">İlgi Radarınız Boş</h3>
        <p className="text-sm text-[var(--text-secondary)]">Sizin için özelleştirilmiş analizleri görmek için birkaç haber okuyun.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 flex flex-col h-full relative overflow-hidden group min-h-[250px]">
      <div className="flex items-center gap-2 mb-6">
        <Compass className="text-[var(--accent-warm)]" size={20} />
        <h3 className="font-bold text-[var(--text-primary)] tracking-wide">Kişisel İlgi Çarkı</h3>
      </div>

      <div className="flex-grow flex flex-col gap-4 justify-center">
        {interests.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-4 group/item">
            <span className="w-20 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              {item.name}
            </span>
            <div className="flex-grow h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
               <div 
                 className="h-full bg-[var(--accent-warm)] rounded-full transition-all duration-1000 ease-out"
                 style={{ width: `${item.pct}%`, opacity: 1 - (idx * 0.15) }}
               />
            </div>
            <span className="w-8 text-right text-[10px] font-black text-[var(--text-muted)]">
              {item.pct}%
            </span>
          </div>
        ))}
      </div>
      
      {/* Şık ve hafif animasyonlu radar grid arka planı */}
      <div className="absolute top-1/2 right-0 translate-x-1/3 -translate-y-1/2 w-48 h-48 rounded-full border-4 border-[var(--border-subtle)] opacity-10 pointer-events-none"></div>
      <div className="absolute top-1/2 right-0 translate-x-[40%] -translate-y-[45%] w-32 h-32 rounded-full border border-[var(--border-subtle)] opacity-20 pointer-events-none"></div>
    </div>
  );
}
