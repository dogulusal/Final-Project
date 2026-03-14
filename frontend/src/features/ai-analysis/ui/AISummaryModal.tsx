"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BiasScaleIndicator from "@/ui/components/BiasScaleIndicator";
import { AlertCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import type { NewsItem } from "@/app/page";

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
      // delay initial loading set to avoid sync cascading renders
      setTimeout(() => { if (active) setStatus("loading"); }, 0);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
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
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
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

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-[var(--bg-primary)] border-[var(--border-subtle)] sm:rounded-2xl gap-0 p-0 font-sans max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="p-4 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <Sparkles className="text-[var(--accent-purple)] w-5 h-5" />
            AI Kaynak Raporu
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-8 custom-scroll">
          {/* Loading State */}
          {status === "loading" && (
            <div className="flex flex-col gap-6 py-4">
              <Skeleton className="h-8 w-3/4 rounded-lg bg-[var(--bg-secondary)]" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full bg-[var(--bg-secondary)]" />
                <Skeleton className="h-6 w-24 rounded-full bg-[var(--bg-secondary)]" />
              </div>
              <Skeleton className="h-4 w-1/2 rounded bg-[var(--bg-secondary)]" />
              <Skeleton className="h-24 w-full rounded-xl bg-[var(--bg-secondary)]" />
              <div className="space-y-2 mt-4">
                 <Skeleton className="h-4 w-full rounded bg-[var(--bg-secondary)]" />
                 <Skeleton className="h-4 w-5/6 rounded bg-[var(--bg-secondary)]" />
                 <Skeleton className="h-4 w-4/6 rounded bg-[var(--bg-secondary)]" />
              </div>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <Alert variant="destructive" className="my-8 border-red-500/20 bg-red-500/10 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Bağlam Kullanılamıyor</AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-4 items-start">
                <p>Haberin yapay zeka tarafından işlenmesi sırasında bir hata oluştu veya bağlantı zaman aşımına uğradı.</p>
                <button 
                  onClick={fetchNewsRetry}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-md shadow-sm transition-colors"
                >
                  Yeniden Dene
                </button>
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {status === "success" && data && (
            <div className="flex flex-col gap-8">
              {/* Headline & Badges */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-center flex-wrap">
                  {data.mlConfidence && (
                    <Badge variant="outline" className="font-bold border-[var(--border-subtle)] text-[var(--text-primary)] tracking-wider">
                      GÜVEN SKORU: %{Math.round(data.mlConfidence)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-bold border-[var(--border-subtle)] text-[var(--text-primary)] tracking-wider">
                    DOĞRULANDI: ✅
                  </Badge>
                </div>
                <h3 className="text-xl md:text-2xl font-serif font-bold leading-tight text-[var(--text-primary)]">
                  {data.baslik}
                </h3>
              </div>

              {/* AI Sentiment Bar */}
              {data.sentiment && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 border-l-2 border-[var(--accent-purple)] pl-2">
                    <span className="sr-only">Duygu:</span> AI Duygu Analizi Yönü
                  </h4>
                  <BiasScaleIndicator sentiment={data.sentiment} />
                </div>
              )}

              {/* Smart Brevity Axiom */}
              {data.metaAciklama && (
                <div className="bg-[var(--bg-secondary)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm relative">
                  <div className="absolute top-0 right-4 -translate-y-1/2 bg-[var(--bg-card)] px-2 py-0.5 rounded text-[10px] font-bold tracking-widest text-[var(--accent-blue)] border border-[var(--border-subtle)] uppercase">
                    Neden Önemli?
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed mt-2 relative z-10">
                    {data.metaAciklama}
                  </p>
                </div>
              )}

              {/* Bullets Breakdown */}
              {data.icerik && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 border-l-2 border-[var(--accent-blue)] pl-2">
                    Önemli Noktalar
                  </h4>
                  <ul className="space-y-3">
                    {data.icerik.split('. ').filter(Boolean).map((pt: string, i: number) => (
                      <li key={i} className="flex gap-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                        <span className="text-[var(--accent-purple)] font-black flex-shrink-0 mt-0.5">·</span>
                        <span>{pt}.</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Footer Reference */}
              {data.kaynakUrl && (
                <div className="pt-5 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)] tracking-wider uppercase font-semibold">Tüm inceleme raporu</span>
                  <a href={data.kaynakUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-[var(--accent-blue)] hover:underline font-bold tracking-wide">
                    ASIL KAYNAĞI GÖR ↗
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
