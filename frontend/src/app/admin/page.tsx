"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Activity, BarChart3, Database, FileText, CheckCircle2, TrendingUp, Zap, Clock } from "lucide-react";

// env-only — compile-time constants, safe at module scope
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const ADMIN_HEADERS = { "x-api-key": process.env.NEXT_PUBLIC_ADMIN_API_KEY || "ag-agency-secret-token-2026" };

interface SchedulerStatus {
    isRunning: boolean;
    lastRun: string | null;
    nextRun: string | null;
    todayCount: number;
    failedSources: string[];
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        totalNews: 0,
        activeCategories: 7,
        mlAccuracy: 85,
        avgConfidence: 89.4,
        abTestCount: 0,
        recentCategorizations: [] as { id: number; baslik: string; tahmin: string; dogruluk: number; tarih: string }[],
        breakdown: {} as Record<string, number>,
        llmBreakdown: {} as Record<string, number>,
        pipeline: { enabled: false, dailyQuota: 100 }
    });
    const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [statsRes, schedulerRes] = await Promise.all([
                    fetch(`${API}/api/admin/stats`, { headers: ADMIN_HEADERS }),
                    fetch(`${API}/api/admin/scheduler-status`, { headers: ADMIN_HEADERS })
                ]);
                const statsData = await statsRes.json();
                const schedulerData = await schedulerRes.json();
                if (statsData.success) {
                    setStats({
                        totalNews: statsData.stats.totalNews,
                        activeCategories: statsData.stats.activeCategories,
                        mlAccuracy: statsData.stats.mlAccuracy,
                        avgConfidence: parseFloat(statsData.stats.avgConfidence),
                        abTestCount: statsData.stats.abTestCount,
                        recentCategorizations: statsData.stats.recentCategorizations,
                        breakdown: statsData.stats.breakdown || {},
                        llmBreakdown: statsData.stats.llmBreakdown || {},
                        pipeline: statsData.stats.pipeline || { enabled: false, dailyQuota: 100 }
                    });
                }
                if (schedulerData.success) setScheduler(schedulerData.data);
            } catch (error) {
                console.error("Admin fetch error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []); // API and ADMIN_HEADERS are module-level constants

    const cards = [
        { title: "Toplam Haber", value: stats.totalNews.toLocaleString('tr-TR'), icon: <FileText size={20} className="text-blue-500" />, trend: `Hazır: ${stats.breakdown['hazir'] ?? 0}` },
        { title: "Aktif Kategori", value: stats.activeCategories, icon: <Database size={20} className="text-purple-500" />, trend: "Sabit" },
        { title: "ML Doğruluk", value: `%${stats.mlAccuracy}`, icon: <CheckCircle2 size={20} className="text-emerald-500" />, trend: "+2.4%" },
        { title: "Güven Skoru", value: `%${stats.avgConfidence}`, icon: <TrendingUp size={20} className="text-rose-500" />, trend: "+1.1%" },
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
            </div>
            <Footer />
        </main>
    );
}
