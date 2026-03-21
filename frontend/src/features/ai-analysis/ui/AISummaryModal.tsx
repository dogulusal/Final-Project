"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BiasScaleIndicator from "@/ui/components/BiasScaleIndicator";
import { AlertCircle, Sparkles, Clock, Eye, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ReadingProgressBar from "@/components/ReadingProgressBar";

import type { NewsItem } from "@/types/news";

export interface AISummaryModalProps {
  newsId: string;
}

export default function AISummaryModal({ newsId }: AISummaryModalProps) {
  const router = useRouter();
  const [data, setData] = useState<NewsItem | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let active = true;
    const fetchNews = async () => {
      setTimeout(() => { if (active) setStatus("loading"); }, 0);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${API_BASE}/api/news/${newsId}`);
        const result = await res.json();
        if (active) {
          if (result.success && result.data) {
            setData(result.data);
            setStatus("success");
          } else {
            setStatus("error");
          }
        }
      } catch {
        if (active) setStatus("error");
      }
    };
    fetchNews();
    return () => { active = false; };
  }, [newsId]);

  const fetchNewsRetry = async () => {
    setStatus("loading");
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${API_BASE}/api/news/${newsId}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      router.back();
    }
  };

  function getSentimentChip(sentiment: string | null) {
    if (sentiment === "Pozitif") return { emoji: "🟢", label: "Pozitif", cls: "bg-green-500/10 text-green-600 border-green-500/20" };
    if (sentiment === "Negatif") return { emoji: "🔴", label: "Negatif", cls: "bg-red-500/10 text-red-600 border-red-500/20" };
    return { emoji: "⚪", label: "Nötr", cls: "bg-gray-500/10 text-gray-500 border-gray-500/20" };
  }

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-[var(--bg-primary)] border-[var(--border-subtle)] sm:rounded-2xl gap-0 p-0 font-sans max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="p-4 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0 relative">
          <ReadingProgressBar targetId="modal-scroll-container" />
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <Sparkles className="text-[var(--accent-warm)] w-4 h-4" />
            AI Kaynak Raporu
          </DialogTitle>
        </DialogHeader>

        <div id="modal-scroll-container" className="p-6 overflow-y-auto flex-grow flex flex-col gap-6 custom-scroll relative">
          {/* Loading State */}
          {status === "loading" && (
            <div className="flex flex-col gap-6 py-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full bg-[var(--bg-secondary)]" />
                <Skeleton className="h-6 w-28 rounded-full bg-[var(--bg-secondary)]" />
              </div>
              <Skeleton className="h-8 w-3/4 rounded-lg bg-[var(--bg-secondary)]" />
              <Skeleton className="h-3 w-1/2 rounded bg-[var(--bg-secondary)]" />
              <Skeleton className="h-16 w-full rounded-xl bg-[var(--bg-secondary)]" />
              <div className="space-y-2 mt-2">
                 <Skeleton className="h-3 w-full rounded bg-[var(--bg-secondary)]" />
                 <Skeleton className="h-3 w-5/6 rounded bg-[var(--bg-secondary)]" />
                 <Skeleton className="h-3 w-4/6 rounded bg-[var(--bg-secondary)]" />
              </div>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <Alert variant="destructive" className="my-8 border-red-500/20 bg-red-500/10 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Bağlam Kullanılamıyor</AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-4 items-start">
                <p>Haberin yapay zeka tarafından işlenmesi sırasında bir hata oluştu.</p>
                <button 
                  onClick={fetchNewsRetry}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-md shadow-sm transition-colors"
                >
                  Yeniden Dene
                </button>
              </AlertDescription>
            </Alert>
          )}

          {/* ✅ Success State — Yeni Hiyerarşi */}
          {status === "success" && data && (
            <div className="flex flex-col gap-6">
              {/* Row 1: Kategori Badge + Sentiment Chip */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md" 
                  style={{ 
                    backgroundColor: `${data.kategori?.renkKodu || 'var(--accent-warm)'}20`, 
                    color: data.kategori?.renkKodu || 'var(--accent-warm)',
                    border: `1px solid ${data.kategori?.renkKodu || 'var(--accent-warm)'}40`
                  }}>
                  {data.kategori?.ad || "Genel"}
                </Badge>
                {data.sentiment && (() => {
                  const chip = getSentimentChip(data.sentiment);
                  return (
                    <Badge variant="outline" className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md ${chip.cls}`}>
                      {chip.emoji} {chip.label}{data.mlConfidence ? ` %${Math.round(data.mlConfidence * 100)}` : ""}
                    </Badge>
                  );
                })()}
                {data.mlConfidence && (
                  <Badge variant="outline" className="font-bold border-[var(--border-subtle)] text-[var(--text-muted)] tracking-wider text-[10px] px-2.5 py-1 rounded-md">
                    DOĞRULANDI ✅
                  </Badge>
                )}
              </div>

              {/* Row 2: Başlık (serif, büyük) */}
              <h3 className="text-xl md:text-2xl font-serif font-bold leading-tight text-[var(--text-primary)]">
                {data.baslik}
              </h3>

              {/* Row 3: Kaynak · Tarih · Okuma Süresi */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(data.yayinlanmaTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {data.okumaSuresiDakika && data.okumaSuresiDakika > 1 && (
                  <>
                    <span>·</span>
                    <span>{data.okumaSuresiDakika} dk okuma</span>
                  </>
                )}
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Eye size={12} />
                  {data.goruntulemeSayisi} görüntülenme
                </span>
              </div>

              {/* Row 4: Duygu Skalası — dinamik confidence */}
              {data.sentiment && (
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <BiasScaleIndicator sentiment={data.sentiment} confidence={data.mlConfidence ?? undefined} />
                </div>
              )}

              {/* Row 5: Neden önemli? — kısa, bold */}
              {data.metaAciklama && (
                <div className="bg-[var(--surface-warm)] p-4 rounded-xl border border-[var(--border-subtle)] relative">
                  <div className="absolute top-0 right-4 -translate-y-1/2 bg-[var(--bg-card)] px-2 py-0.5 rounded text-[9px] font-bold tracking-widest text-[var(--accent-blue)] border border-[var(--border-subtle)] uppercase">
                    💡 Neden Önemli?
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed mt-1">
                    {data.metaAciklama}
                  </p>
                </div>
              )}

              {/* Row 6: Madde madde özet */}
              {data.icerik && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 border-l-2 border-[var(--accent-warm)] pl-2">
                    Önemli Noktalar
                  </h4>
                  <ul className="space-y-2.5">
                    {data.icerik.split('. ').filter(Boolean).map((pt: string, i: number) => (
                      <li key={i} className="flex gap-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                        <span className="text-[var(--accent-warm)] font-black flex-shrink-0 mt-0.5">·</span>
                        <span>{pt}.</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer: Kaynak bağlantısı */}
              {data.kaynakUrl && (
                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)] tracking-wider uppercase font-semibold">Tüm inceleme raporu</span>
                  <a href={data.kaynakUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-[var(--accent-blue)] hover:underline font-bold tracking-wide">
                    <ExternalLink size={12} />
                    ASIL KAYNAĞI GÖR
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
