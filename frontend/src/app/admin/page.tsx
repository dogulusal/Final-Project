"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Activity, BarChart3, Database, FileText, CheckCircle2, TrendingUp } from "lucide-react";

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        totalNews: 0,
        activeCategories: 7,
        mlAccuracy: 85,
        avgConfidence: 89.4,
        abTestCount: 0,
        recentCategorizations: [] as any[]
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`, {
                    headers: {
                        'x-api-key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'ag-agency-secret-token-2026'
                    }
                });
                const data = await response.json();
                if (data.success) {
                    setStats({
                        totalNews: data.stats.totalNews,
                        activeCategories: data.stats.activeCategories,
                        mlAccuracy: data.stats.mlAccuracy,
                        avgConfidence: parseFloat(data.stats.avgConfidence),
                        abTestCount: data.stats.abTestCount,
                        recentCategorizations: data.stats.recentCategorizations
                    });
                }
            } catch (error) {
                console.error("Stats fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const cards = [
        { title: "Toplam Haber", value: stats.totalNews, icon: <FileText size={20} className="text-blue-500" />, trend: "+12%" },
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
                                                %{item.guven}
                                            </td>
                                            <td className="py-3 text-right">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${parseFloat(item.guven) < 60 ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                                    {parseFloat(item.guven) < 60 ? 'Manuel' : 'Oto'}
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
