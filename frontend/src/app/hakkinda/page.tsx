"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TECH_STACK = [
    { icon: "📡", title: "RSS Toplama", desc: "BBC, NTV, Sözcü ve fazlası" },
    { icon: "🤖", title: "ML Kategorizasyon", desc: "Naive Bayes sınıflandırma" },
    { icon: "🧠", title: "Gemini AI", desc: "İçerik özgünleştirme" },
    { icon: "🔍", title: "Dedup Engine", desc: "Jaro-Winkler benzerlik" },
    { icon: "🎨", title: "Görsel Üretim", desc: "Canvas ile otomatik görsel" },
    { icon: "📲", title: "Paylaşım", desc: "Telegram + Sosyal medya" },
];

const ARCHITECTURE = [
    { label: "Frontend", tech: "Next.js 16 + Tailwind", color: "var(--accent-blue)" },
    { label: "Backend", tech: "Express + Prisma", color: "var(--accent-purple)" },
    { label: "Otomasyon", tech: "n8n (4 Workflow)", color: "var(--accent-emerald)" },
    { label: "Veritabanı", tech: "PostgreSQL", color: "var(--accent-cyan)" },
    { label: "LLM", tech: "Google Gemini AI", color: "var(--accent-rose)" },
    { label: "Konteyner", tech: "Docker Compose", color: "var(--accent-amber)" },
];

export default function HakkindaPage() {
    return (
        <main className="min-h-screen">
            <Navbar />
            <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-6">
                        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link>
                        <span>›</span>
                        <span className="text-[var(--text-secondary)]">Hakkında</span>
                    </nav>

                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">
                        Proje <span className="gradient-text">Hakkında</span>
                    </h1>
                    <p className="text-sm text-[var(--text-secondary)] mb-10 max-w-xl">
                        Bu platform, haberleri otomatik toplayan, ML ile kategorize eden ve Gemini AI ile özgünleştiren uçtan uca bir haber ajansı sistemidir.
                    </p>

                    {/* Pipeline */}
                    <h2 className="text-xl font-bold mb-5">Nasıl Çalışır?</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
                        {TECH_STACK.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.06 }}
                                className="glass-card p-4 text-center"
                            >
                                <span className="text-2xl block mb-2">{item.icon}</span>
                                <span className="text-xs font-bold block mb-1">{item.title}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">{item.desc}</span>
                            </motion.div>
                        ))}
                    </div>

                    {/* Architecture */}
                    <h2 className="text-xl font-bold mb-5">Teknoloji Mimarisi</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
                        {ARCHITECTURE.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.05 }}
                                className="glass-card p-4"
                            >
                                <div className="w-2 h-2 rounded-full mb-3" style={{ background: item.color }} />
                                <span className="text-sm font-bold block">{item.label}</span>
                                <span className="text-xs text-[var(--text-muted)]">{item.tech}</span>
                            </motion.div>
                        ))}
                    </div>

                    {/* GitHub Link */}
                    <div className="glass-card p-6 text-center">
                        <p className="text-sm text-[var(--text-secondary)] mb-4">Kaynak kodunu incelemek için:</p>
                        <a href="https://github.com/dogulusal/Final-Project" target="_blank" rel="noopener noreferrer"
                            className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                            style={{ background: "var(--gradient-hero)" }}>
                            GitHub Repo →
                        </a>
                    </div>
                </motion.div>
            </section>
            <Footer />
        </main>
    );
}
