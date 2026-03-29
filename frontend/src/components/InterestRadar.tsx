"use client";

import { useReadingHistory } from "@/hooks/useReadingHistory";
import { Radar, Compass } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

export default function InterestRadar() {
  const { getInterests, isPersonalized, historyVersion } = useReadingHistory();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
    fetch(`${apiUrl}/api/news/categories`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const map: Record<number, string> = {};
          data.data.forEach((cat: { id: number; ad: string }) => {
            map[cat.id] = cat.ad;
          });
          setCategoryMap(map);
        }
      })
      .catch(() => {});
  }, []);

  const interests = useMemo(() => {
    const raw = getInterests() as Record<string, number>;
    const categories = Object.keys(raw);
    if (!categories.length) return [];
    
    // Basit bir bubble/bar representation
    const maxScore = Math.max(...Object.values(raw).map(val => Number(val)));
    
    return categories.map(cat => ({
      name: categoryMap[Number(cat)] || cat,
      score: Number(raw[cat]),
      pct: Math.round((Number(raw[cat]) / maxScore) * 100)
    })).sort((a,b) => b.score - a.score).slice(0, 5); // top 5
  }, [getInterests, historyVersion, categoryMap]);

  if (!isPersonalized || interests.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center h-full text-center min-h-[250px] relative overflow-hidden group">
        <Radar size={40} className="text-[var(--accent-warm)] opacity-25 mb-4" />
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">Kişisel İlgi Çarkı</h3>
        {!isPersonalized ? (
          <p className="text-xs text-[var(--text-secondary)] max-w-[220px] leading-relaxed">
            Sayfanın altındaki çerez bildirimini kabul ettikten sonra okuduğunuz haberlere göre ilgi alanlarınız burada görünür.
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)] max-w-[220px] leading-relaxed">
            Birkaç haber okuyun — kategorileriniz otomatik olarak burada şekillenecek.
          </p>
        )}
      </div>
    );
  }

  const radarSize = 220;
  const center = radarSize / 2;
  const maxRadius = 82;
  const levels = 4;

  const pointFor = (index: number, pct: number, radiusScale = 1) => {
    const angle = (Math.PI * 2 * index) / interests.length - Math.PI / 2;
    const r = (pct / 100) * maxRadius * radiusScale;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const polygonPoints = interests
    .map((item, index) => {
      const p = pointFor(index, item.pct);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <div className="glass-card p-6 flex flex-col h-full relative overflow-hidden group min-h-[250px]">
      <div className="flex items-center gap-2 mb-6">
        <Compass className="text-[var(--accent-warm)]" size={20} />
        <h3 className="font-bold text-[var(--text-primary)] tracking-wide">Kişisel İlgi Çarkı</h3>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-center">
        <div className="flex flex-col gap-4 justify-center">
          {interests.map((item, idx) => (
            <button
              key={item.name}
              onMouseEnter={() => setHoveredCategory(item.name)}
              onMouseLeave={() => setHoveredCategory(null)}
              className="flex items-center gap-4 group/item text-left"
              aria-label={`${item.name} ilgi oranı`}
              type="button"
            >
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
            </button>
          ))}
        </div>

        <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] mx-auto">
          <svg
            viewBox={`0 0 ${radarSize} ${radarSize}`}
            className="w-full h-full"
            role="img"
            aria-label="Kişisel ilgi radar grafiği"
          >
            <title>Kişisel ilgi radar grafiği</title>
            {[...Array(levels)].map((_, levelIdx) => {
              const levelScale = (levelIdx + 1) / levels;
              const ring = interests
                .map((__, axisIdx) => {
                  const p = pointFor(axisIdx, 100, levelScale);
                  return `${p.x},${p.y}`;
                })
                .join(" ");
              return (
                <polygon
                  key={levelIdx}
                  points={ring}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                  opacity={0.7 - levelIdx * 0.12}
                />
              );
            })}

            {interests.map((item, idx) => {
              const p = pointFor(idx, 100, 1.05);
              return (
                <line
                  key={`axis-${item.name}`}
                  x1={center}
                  y1={center}
                  x2={p.x}
                  y2={p.y}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                  opacity="0.6"
                />
              );
            })}

            <polygon
              points={polygonPoints}
              fill="var(--accent-warm)"
              fillOpacity="0.2"
              stroke="var(--accent-warm)"
              strokeWidth="2"
            />

            {interests.map((item, idx) => {
              const p = pointFor(idx, item.pct);
              const isHovered = hoveredCategory === item.name;
              return (
                <g key={`point-${item.name}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 5 : 3.5}
                    fill="var(--accent-warm)"
                    className="transition-all duration-200"
                  />
                  {isHovered && (
                    <text
                      x={p.x + 7}
                      y={p.y - 7}
                      fill="var(--text-primary)"
                      fontSize="10"
                      fontWeight="700"
                    >
                      %{item.pct}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {hoveredCategory && (
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{hoveredCategory}</span> kategorisi son okuma alışkanlığında öne çıkıyor.
        </div>
      )}
      
      {/* Şık ve hafif animasyonlu radar grid arka planı */}
      <div className="absolute top-1/2 right-0 translate-x-1/3 -translate-y-1/2 w-48 h-48 rounded-full border-4 border-[var(--border-subtle)] opacity-10 pointer-events-none"></div>
      <div className="absolute top-1/2 right-0 translate-x-[40%] -translate-y-[45%] w-32 h-32 rounded-full border border-[var(--border-subtle)] opacity-20 pointer-events-none"></div>
    </div>
  );
}
