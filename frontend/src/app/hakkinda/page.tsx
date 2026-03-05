"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TECH_STACK = [
    { icon: "📡", title: "RSS Haber Toplama", desc: "Çoklu RSS kaynaklarından otomatik haber çekme ve ayrıştırma" },
    { icon: "🤖", title: "ML Kategorisasyon", desc: "Naive Bayes algoritması ile otomatik haber sınıflandırma" },
    { icon: "🧠", title: "LLM Özgünleştirme", desc: "Gemini AI ile haberlerin benzersiz ve akıcı yeniden yazımı" },
    { icon: "🖼️", title: "Görsel Oluşturma", desc: "Canvas API ile her habere özel sosyal medya görseli" },
    { icon: "🔄", title: "n8n Orkestrasyon", desc: "4 farklı workflow ile uçtan uca otomasyon" },
    { icon: "🛡️", title: "Deduplication", desc: "Jaro-Winkler algoritması ile kopya haber engelleme (%80 eşik)" },
];

const ARCHITECTURE = [
    { layer: "Veri Toplama", tools: "RSS Parser, n8n Workflow 1", color: "var(--accent-cyan)" },
    { layer: "İşleme", tools: "ML Kategorisasyon, Gemini AI LLM, Dedup", color: "var(--accent-purple)" },
    { layer: "Depolama", tools: "PostgreSQL, Prisma ORM", color: "var(--accent-blue)" },
    { layer: "Sunum", tools: "Next.js 16, Tailwind CSS, Framer Motion", color: "var(--accent-emerald)" },
    { layer: "Dağıtım", tools: "Telegram Bot, n8n Workflow 3", color: "var(--accent-amber)" },
    { layer: "İzleme", tools: "Health Check, n8n Workflow 4", color: "var(--accent-rose)" },
];

export default function HakkindaPage() {
    return (
        <main className="min-h-screen">
            <Navbar />
            <section className="max-w-[1100px] mx-auto px-6 lg:px-12 py-16">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
                        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link>
                        <span>›</span>
                        <span className="text-[var(--text-secondary)]">Hakkında</span>
                    </nav>

                    {/* Hero */}
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6">
                        Proje <span className="gradient-text">Hakkında</span>
                    </h1>
                    <p className="text-xl text-[var(--text-secondary)] font-light mb-16 max-w-2xl leading-relaxed">
                        AI Haber Ajansı, haberleri otomatik olarak toplayan, yapay zeka ile kategorize eden,
                        özgünleştiren ve yayınlayan uçtan uca bir haber otomasyon platformudur.
                    </p>

                    {/* Nasıl Çalışır */}
                    <h2 className="text-2xl font-bold mb-8">Nasıl Çalışır?</h2>
                    <div className="space-y-4 mb-20">
                        {ARCHITECTURE.map((item, i) => (
                            <motion.div
                                key={item.layer}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.08 }}
                                className="glass-card p-5 flex items-center gap-5"
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                                    style={{ background: `${item.color}20`, color: item.color }}>
                                    {i + 1}
                                </div>
                                <div>
                                    <span className="font-bold text-base">{item.layer}</span>
                                    <span className="text-sm text-[var(--text-muted)] ml-3">{item.tools}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Teknoloji */}
                    <h2 className="text-2xl font-bold mb-8">Teknoloji Yığını</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
                        {TECH_STACK.map((tech, i) => (
                            <motion.div
                                key={tech.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.06 }}
                                className="glass-card p-6"
                            >
                                <span className="text-3xl block mb-3">{tech.icon}</span>
                                <h3 className="text-base font-bold mb-2">{tech.title}</h3>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{tech.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Proje Bilgisi */}
                    <div className="glass-card p-8 text-center">
                        <h3 className="text-xl font-bold mb-3">Açık Kaynak Proje</h3>
                        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-lg mx-auto">
                            Bu proje bir Final Projesi olarak geliştirilmiştir. Kaynak koduna GitHub üzerinden erişebilirsiniz.
                        </p>
                        <a href="https://github.com/dogulusal/Final-Project" target="_blank" rel="noopener noreferrer"
                            className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-105 inline-block"
                            style={{ background: "var(--gradient-hero)" }}>
                            GitHub&apos;da Görüntüle
                        </a>
                    </div>
                </motion.div>
            </section>
            <Footer />
        </main>
    );
}
