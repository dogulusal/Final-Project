"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, Database, FileText, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { getAccessToken, isLoggedIn, apiFetch, clearTokens } from "@/lib/auth";

// env-only — compile-time constants, safe at module scope
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface SchedulerStatus {
    isRunning: boolean;
    lastRun: string | null;
    nextRun: string | null;
    todayCount: number;
    failedSources: string[];
}

interface MLVerificationMetrics {
    totalRecords: number;
    verifiedRecords: number;
    verificationRate: number;
    pendingRecords: number;
    disputedRecords: number;
}

interface DisputeCategory {
    id: number;
    ad: string;
}

interface DisputeItem {
    id: number;
    haberId: number;
    nbKategoriId: number | null;
    llmKategoriId: number | null;
    nbGuvenSkoru: number | null;
    llmGuvenSkoru?: number | null;
    haber: {
        id: number;
        baslik: string;
    };
    nbKategori: DisputeCategory | null;
    llmKategori: DisputeCategory | null;
}

interface DisputeBucket {
    key: string;
    count: number;
}

interface DisputeSummary {
    total: number;
    byPair: DisputeBucket[];
    byNb: DisputeBucket[];
    byLlm: DisputeBucket[];
}

function buildDisputeSummary(items: DisputeItem[]): DisputeSummary {
    const pairCounts = new Map<string, number>();
    const nbCounts = new Map<string, number>();
    const llmCounts = new Map<string, number>();

    for (const item of items) {
        const nbLabel = item.nbKategori?.ad || "—";
        const llmLabel = item.llmKategori?.ad || "—";
        const pairKey = `${nbLabel} -> ${llmLabel}`;

        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
        nbCounts.set(nbLabel, (nbCounts.get(nbLabel) || 0) + 1);
        llmCounts.set(llmLabel, (llmCounts.get(llmLabel) || 0) + 1);
    }

    const toSortedBuckets = (counts: Map<string, number>): DisputeBucket[] => (
        Array.from(counts.entries())
            .map(([key, count]) => ({ key, count }))
            .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key, "tr"))
    );

    return {
        total: items.length,
        byPair: toSortedBuckets(pairCounts),
        byNb: toSortedBuckets(nbCounts),
        byLlm: toSortedBuckets(llmCounts),
    };
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalNews: 0,
        activeCategories: 7,
        mlAccuracy: 85,
        avgPredictionConfidence: 89.4,
        confidenceSampleSize: 0,
        mlTrainSize: 0,
        mlTestSize: 0,
        abTestCount: 0,
        recentCategorizations: [] as { id: number; baslik: string; tahmin: string; dogruluk: number; tarih: string }[],
        breakdown: {} as Record<string, number>,
        llmBreakdown: {} as Record<string, number>,
        pipeline: { enabled: false, dailyQuota: 100 },
        mlVerification: { totalRecords: 0, verifiedRecords: 0, verificationRate: 0, pendingRecords: 0, disputedRecords: 0 } as MLVerificationMetrics
    });
    const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [disputes, setDisputes] = useState<DisputeItem[]>([]);
    const [disputeSummary, setDisputeSummary] = useState<DisputeSummary | null>(null);
    const [categories, setCategories] = useState<DisputeCategory[]>([]);
    const [selectedDecisions, setSelectedDecisions] = useState<Record<number, number>>({});
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [resolving, setResolving] = useState(false);
    const [disputeError, setDisputeError] = useState<string | null>(null);

    const handleUnauthorized = () => {
        clearTokens();
        router.push('/login');
    };

    const fetchDisputes = async () => {
        const token = getAccessToken();
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const [disputesRes, categoriesRes] = await Promise.all([
            fetch(`${API}/api/ml/disputes/pending?limit=100`, { headers }),
            fetch(`${API}/api/news/categories`),
        ]);

        if (disputesRes.status === 401) {
            handleUnauthorized();
            return;
        }

        const disputesData = await disputesRes.json();
        const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { success: false };

        const items = disputesData.success ? (disputesData.data?.items || []) as DisputeItem[] : [];
        setDisputes(items);
        setDisputeSummary(buildDisputeSummary(items));

        if (categoriesData.success && Array.isArray(categoriesData.data)) {
            setCategories(categoriesData.data.map((category: DisputeCategory) => ({ id: category.id, ad: category.ad })));
        }
    };

    const resolveSelectedDisputes = async () => {
        const decisions = Object.entries(selectedDecisions).map(([disputeId, chosenKategoriId]) => ({
            disputeId: Number(disputeId),
            chosenKategoriId,
            reason: 'admin-panel-manual-review',
        }));

        if (decisions.length === 0) {
            setDisputeError('Önce en az bir dispute için karar seçin.');
            return;
        }

        setResolving(true);
        setDisputeError(null);

        try {
            const response = await apiFetch(`${API}/api/ml/resolve-disputes-batch`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decisions }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            setSelectedDecisions({});
            setOpenMenuId(null);
            await fetchDisputes();
        } catch (error) {
            setDisputeError(error instanceof Error ? error.message : 'Dispute çözümünde hata oluştu.');
        } finally {
            setResolving(false);
        }
    };

    useEffect(() => {
        // Login kontrolü
        if (!isLoggedIn()) {
            router.push('/login');
            return;
        }

        const fetchAll = async () => {
            try {
                const token = getAccessToken();
                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                };

                const [statsRes, schedulerRes] = await Promise.all([
                    fetch(`${API}/api/admin/stats`, { headers }),
                    fetch(`${API}/api/admin/scheduler-status`, { headers })
                ]);

                // Auth hatası — logout yap
                if (statsRes.status === 401 || schedulerRes.status === 401) {
                    handleUnauthorized();
                    return;
                }

                const statsData = await statsRes.json();
                const schedulerData = await schedulerRes.json();
                if (statsData.success) {
                    setStats({
                        totalNews: statsData.stats.totalNews,
                        activeCategories: statsData.stats.activeCategories,
                        mlAccuracy: statsData.stats.mlAccuracy,
                        avgPredictionConfidence: parseFloat(statsData.stats.avgPredictionConfidence ?? statsData.stats.avgConfidence ?? 0),
                        confidenceSampleSize: statsData.stats.confidenceSampleSize || 0,
                        mlTrainSize: statsData.stats.mlTrainSize || 0,
                        mlTestSize: statsData.stats.mlTestSize || 0,
                        abTestCount: statsData.stats.abTestCount,
                        recentCategorizations: statsData.stats.recentCategorizations,
                        breakdown: statsData.stats.breakdown || {},
                        llmBreakdown: statsData.stats.llmBreakdown || {},
                        pipeline: statsData.stats.pipeline || { enabled: false, dailyQuota: 100 },
                        mlVerification: {
                            totalRecords: statsData.stats.mlVerification?.totalRecords || statsData.stats.totalNews || 0,
                            verifiedRecords: statsData.stats.mlVerification?.verifiedRecords || 0,
                            verificationRate: statsData.stats.mlVerification?.verificationRate || 0,
                            pendingRecords: statsData.stats.mlVerification?.pendingRecords || 0,
                            disputedRecords: statsData.stats.mlVerification?.disputedRecords || 0,
                        }
                    });
                }
                if (schedulerData.success) setScheduler(schedulerData.data);
                await fetchDisputes();
            } catch (error) {
                console.error("Admin fetch error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [router]);

    const cards = [
        { title: "Toplam Haber", value: stats.totalNews.toLocaleString('tr-TR'), icon: <FileText size={20} className="text-blue-500" />, trend: `Hazır: ${stats.breakdown['hazir'] ?? 0}` },
        { title: "Aktif Kategori", value: stats.activeCategories, icon: <Database size={20} className="text-purple-500" />, trend: "Sabit" },
        { title: "ML Doğruluk", value: `%${stats.mlAccuracy}`, icon: <CheckCircle2 size={20} className="text-emerald-500" />, trend: stats.mlTestSize > 0 ? `Doğrulanan test: ${stats.mlTestSize}` : "Model aktif" },
        { title: "Ort. Tahmin Güveni", value: `%${stats.avgPredictionConfidence}`, icon: <TrendingUp size={20} className="text-rose-500" />, trend: stats.confidenceSampleSize > 0 ? `Hazır haber: ${stats.confidenceSampleSize}` : "Tahmin ortalaması" },
    ];

    return (
        <main className="min-h-screen bg-[var(--bg-secondary)]">
            <Navbar />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                            Yönetici Paneli
                        </h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Sistem istatistikleri ve ML motor durumu.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="glass-card p-6 h-32" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {cards.map((card, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="glass-card p-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 rounded-lg bg-[var(--text-secondary)] bg-opacity-10">
                                        {card.icon}
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                        {card.trend}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</h3>
                                <p className="text-sm text-[var(--text-secondary)] font-medium mt-1">{card.title}</p>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* LLM Pipeline Durumu + Scheduler Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    {/* LLM Pipeline Durumu */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <Zap className={stats.pipeline.enabled ? "text-emerald-500" : "text-amber-500"} />
                            <h2 className="text-xl font-bold">LLM Pipeline</h2>
                            <span className={`ml-auto text-[10px] uppercase font-bold px-2 py-1 rounded-full ${stats.pipeline.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {stats.pipeline.enabled ? 'Aktif' : 'Kapalı'}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: 'Hazır (LLM)', key: 'hazir', color: 'bg-emerald-500' },
                                { label: 'Ham (İşlenmemiş)', key: 'ham', color: 'bg-amber-500' },
                                { label: 'Yayında', key: 'yayinda', color: 'bg-blue-500' }
                            ].map(({ label, key, color }) => {
                                const count = stats.breakdown[key] ?? 0;
                                const pct = stats.totalNews > 0 ? Math.round((count / stats.totalNews) * 100) : 0;
                                return (
                                    <div key={key} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-[var(--text-secondary)]">{label}</span>
                                            <span className="font-bold">{count.toLocaleString('tr-TR')} <span className="text-[var(--text-muted)] font-normal">(%{pct})</span></span>
                                        </div>
                                        <div className="w-full bg-[var(--border-subtle)] rounded-full h-1.5">
                                            <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="pt-1 text-xs text-[var(--text-muted)]">
                                {Object.entries(stats.llmBreakdown).map(([provider, count]) => (
                                    <span key={provider} className="inline-block mr-3">
                                        <span className="font-semibold text-[var(--text-secondary)]">{provider}:</span> {(count as number).toLocaleString('tr-TR')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Scheduler Durumu */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <Clock className={scheduler?.isRunning ? "text-emerald-500" : "text-rose-500"} />
                            <h2 className="text-xl font-bold">RSS Scheduler</h2>
                            <span className={`ml-auto text-[10px] uppercase font-bold px-2 py-1 rounded-full ${scheduler?.isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {scheduler?.isRunning ? 'Çalışıyor' : 'Durdu'}
                            </span>
                        </div>
                        {scheduler ? (
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                    <span className="text-[var(--text-muted)]">Son Çalışma</span>
                                    <span className="font-medium">{scheduler.lastRun ? new Date(scheduler.lastRun).toLocaleTimeString('tr-TR') : '—'}</span>
                                </div>
                                <div className="flex justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                    <span className="text-[var(--text-muted)]">Sonraki Çalışma</span>
                                    <span className="font-medium">{scheduler.nextRun ? new Date(scheduler.nextRun).toLocaleTimeString('tr-TR') : '—'}</span>
                                </div>
                                <div className="flex justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                    <span className="text-[var(--text-muted)]">Bugün Eklenen</span>
                                    <span className="font-bold text-emerald-500">{scheduler.todayCount}</span>
                                </div>
                                {scheduler.failedSources.length > 0 && (
                                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                                        ⚠️ Sağlıksız kaynaklar: {scheduler.failedSources.join(', ')}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-[var(--text-muted)] text-sm italic">Scheduler verisi alınamadı.</p>
                        )}
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    {/* A/B Test Sonuçları Panel */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <Activity className="text-[var(--accent-purple)]" />
                            <h2 className="text-xl font-bold">A/B Test Raporları</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-sm">Toplam Gerçekleşen Test</span>
                                    <span className="text-purple-500 font-bold text-sm tracking-widest">{stats.abTestCount} Dosya</span>
                                </div>
                                <div className="w-full bg-[var(--border-subtle)] rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: stats.abTestCount > 0 ? '100%' : '0%' }}></div>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">A/B test verileri `training/ab-tests` klasöründe JSON olarak tutulmaktadır.</p>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-sm">Model Kapsama Oranı</span>
                                    <span className="text-emerald-500 font-bold text-sm">%100</span>
                                </div>
                                <div className="w-full bg-[var(--border-subtle)] rounded-full h-2">
                                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Yakın Zamandaki ML Sınıflandırmaları */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart3 className="text-[var(--accent-blue)]" />
                            <h2 className="text-xl font-bold">Son Kategorizasyon İşlemleri</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                                        <th className="pb-3 font-medium">Haber</th>
                                        <th className="pb-3 font-medium text-center">Güven</th>
                                        <th className="pb-3 font-medium text-right">Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentCategorizations.length > 0 ? stats.recentCategorizations.map((item, i) => (
                                        <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                                            <td className="py-3 font-medium text-[var(--text-primary)] truncate max-w-[200px]" title={item.baslik}>
                                                {item.baslik}
                                            </td>
                                            <td className="py-3 text-center text-[var(--text-secondary)]">
                                                %{Math.round((item.dogruluk ?? 0) * 100)}
                                            </td>
                                            <td className="py-3 text-right">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${(item.dogruluk ?? 0) < 0.6 ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                                    {(item.dogruluk ?? 0) < 0.6 ? 'Manuel' : 'Oto'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center text-[var(--text-muted)] italic text-xs">
                                                Henüz kategorize edilmiş haber bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* ML Kategorilendirme Doğrulama Widget */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 mt-8"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <CheckCircle2 className="text-emerald-500" />
                        <h2 className="text-xl font-bold">ML Kategorilendirme Doğrulama</h2>
                        <span className="ml-auto text-[10px] uppercase font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                            Güncel
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">Toplam Kayıt</p>
                            <p className="text-3xl font-bold text-[var(--text-primary)]">{stats.mlVerification.totalRecords.toLocaleString('tr-TR')}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">Doğrulanmış</p>
                            <p className="text-3xl font-bold text-emerald-500">{stats.mlVerification.verifiedRecords.toLocaleString('tr-TR')}</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">%{stats.mlVerification.verificationRate}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">Kalan / Bekleyen</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-amber-500 font-bold">Kalan: {stats.mlVerification.pendingRecords}</span>
                                <span className="text-rose-500 font-bold">• Dispute: {stats.mlVerification.disputedRecords}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                        <p className="text-[var(--text-secondary)] font-medium mb-3">Doğrulama Oranı </p>
                        <div className="w-full bg-[var(--border-subtle)] rounded-full h-3">
                            <div 
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all" 
                                style={{ width: `${Math.min(stats.mlVerification.verificationRate, 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                            ✅ Başarıyla doğrulanmış haberler eğitim setinde kullanılıyor. Sistem doğruluk ve güvenirliği artıyor.
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 mt-8"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <AlertTriangle className="text-amber-500" />
                        <h2 className="text-xl font-bold">Dispute Çözüm Merkezi</h2>
                        <div className="ml-auto flex items-center gap-2">
                            {disputes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextSelections: Record<number, number> = {};
                                        disputes.forEach((item) => {
                                            if (item.llmKategoriId) {
                                                nextSelections[item.id] = item.llmKategoriId;
                                            }
                                        });
                                        setSelectedDecisions(nextSelections);
                                        setDisputeError(null);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                                >
                                    Tümünü LLM Seç
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { void fetchDisputes(); }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]"
                            >
                                <RefreshCw size={14} /> Yenile
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">Bekleyen Dispute</p>
                            <p className="text-2xl font-bold text-amber-500">{disputeSummary?.total ?? 0}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">En Sık Çift</p>
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={disputeSummary?.byPair[0]?.key || '—'}>
                                {disputeSummary?.byPair[0]?.key || '—'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{disputeSummary?.byPair[0]?.count ?? 0} kayıt</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">NB+LR En Sık</p>
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={disputeSummary?.byNb[0]?.key || '—'}>
                                {disputeSummary?.byNb[0]?.key || '—'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{disputeSummary?.byNb[0]?.count ?? 0} kayıt</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <p className="text-[var(--text-muted)] text-sm mb-1">LLM En Sık</p>
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={disputeSummary?.byLlm[0]?.key || '—'}>
                                {disputeSummary?.byLlm[0]?.key || '—'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{disputeSummary?.byLlm[0]?.count ?? 0} kayıt</p>
                        </div>
                    </div>

                    {disputeError && (
                        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
                            {disputeError}
                        </div>
                    )}

                    <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-[var(--bg-secondary)]">
                                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                                    <th className="p-3 font-medium">Haber</th>
                                    <th className="p-3 font-medium">NB+LR</th>
                                    <th className="p-3 font-medium">LLM</th>
                                    <th className="p-3 font-medium text-center">Karar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {disputes.length > 0 ? disputes.map((item) => {
                                    const selectedCategoryId = selectedDecisions[item.id];
                                    const nbSelected = selectedCategoryId === item.nbKategoriId;
                                    const llmSelected = selectedCategoryId === item.llmKategoriId;

                                    return (
                                        <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0">
                                            <td className="p-3 align-top">
                                                <p className="font-semibold text-[var(--text-primary)] line-clamp-2" title={item.haber.baslik}>
                                                    {item.haber.baslik}
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                                    Dispute #{item.id} • Haber #{item.haberId}
                                                </p>
                                            </td>
                                            <td className="p-3 align-top">
                                                <p className="font-semibold">{item.nbKategori?.ad || '—'}</p>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    Güven: {typeof item.nbGuvenSkoru === 'number' ? `%${Math.round(item.nbGuvenSkoru * 100)}` : '—'}
                                                </p>
                                            </td>
                                            <td className="p-3 align-top">
                                                <p className="font-semibold">{item.llmKategori?.ad || '—'}</p>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    Güven: {typeof item.llmGuvenSkoru === 'number' ? `%${Math.round(item.llmGuvenSkoru * 100)}` : '—'}
                                                </p>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (item.nbKategoriId) {
                                                                    setSelectedDecisions((prev) => ({ ...prev, [item.id]: item.nbKategoriId as number }));
                                                                    setDisputeError(null);
                                                                }
                                                            }}
                                                            disabled={!item.nbKategoriId}
                                                            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${nbSelected ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]'}`}
                                                        >
                                                            NB+LR'yi Seç
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (item.llmKategoriId) {
                                                                    setSelectedDecisions((prev) => ({ ...prev, [item.id]: item.llmKategoriId as number }));
                                                                    setDisputeError(null);
                                                                }
                                                            }}
                                                            disabled={!item.llmKategoriId}
                                                            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${llmSelected ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]'}`}
                                                        >
                                                            LLM'i Seç
                                                        </button>
                                                    </div>
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                                            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${!nbSelected && !llmSelected && selectedCategoryId ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}
                                                        >
                                                            {nbSelected || llmSelected || !selectedCategoryId ? 'Diğer ▾' : categories.find((category) => category.id === selectedCategoryId)?.ad ?? 'Diğer'}
                                                        </button>
                                                        {openMenuId === item.id && (
                                                            <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl shadow-lg py-1 min-w-[130px]">
                                                                {categories.map((category) => (
                                                                    <button
                                                                        key={category.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedDecisions((prev) => ({ ...prev, [item.id]: category.id }));
                                                                            setOpenMenuId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                                                                    >
                                                                        {category.ad}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-[var(--text-muted)] italic text-xs">
                                            Bekleyen dispute kaydı yok.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-3">
                        <span className="text-xs text-[var(--text-muted)]">Seçili: {Object.keys(selectedDecisions).length}</span>
                        <button
                            type="button"
                            onClick={() => { void resolveSelectedDisputes(); }}
                            disabled={resolving || Object.keys(selectedDecisions).length === 0}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {resolving ? 'Çözülüyor...' : 'Seçilenleri Çöz'}
                        </button>
                    </div>
                </motion.div>
            </div>
            <Footer />
        </main>
    );
}
