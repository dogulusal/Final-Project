"use client";

import { motion } from "framer-motion";

export default function HeroSection() {
    return (
        <section className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
            {/* Subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50vw] h-[400px] rounded-full opacity-[0.07] blur-[100px] pointer-events-none"
                style={{ background: "var(--gradient-hero)" }} />

            <div className="max-w-7xl mx-auto text-center relative z-10">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-5"
                >
                    Haberleri{" "}
                    <span className="gradient-text">Yapay Zeka</span>{" "}
                    ile Keşfet
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-base sm:text-lg text-[var(--text-secondary)] font-light max-w-2xl mx-auto mb-8"
                >
                    Makine öğrenmesi ile kategorize edilen ve akıllıca sentezlenen yeni nesil haber akışı.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <a href="#news" className="inline-block px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                        style={{ background: "var(--gradient-hero)" }}>
                        Haberlere Göz At
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
