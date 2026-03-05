"use client";

import { motion } from "framer-motion";

export default function HeroSection() {
    return (
        <section className="relative overflow-hidden py-20 px-4">
            {/* Glow effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ background: "var(--gradient-hero)" }} />

            <div className="max-w-4xl mx-auto text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium"
                        style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", color: "var(--accent-blue)" }}>
                        <span className="pulse-dot" />
                        Yapay Zeka Destekli — 7/24 Aktif
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6"
                >
                    Haberleri{" "}
                    <span className="gradient-text">Yapay Zeka</span>{" "}
                    ile Keşfet
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-lg sm:text-xl max-w-2xl mx-auto mb-10"
                    style={{ color: "var(--text-secondary)" }}
                >
                    RSS kaynaklarından toplanan haberler, makine öğrenmesi ile kategorize edilir,
                    LLM modelleri ile özgünleştirilir ve size sunulur.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                    <a href="#news" className="px-8 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg"
                        style={{ background: "var(--gradient-hero)" }}>
                        Haberlere Göz At →
                    </a>
                    <a href="/hakkinda" className="px-8 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 hover:scale-105"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                        Nasıl Çalışır?
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
