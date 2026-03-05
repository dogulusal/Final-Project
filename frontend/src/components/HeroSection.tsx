"use client";

import { motion } from "framer-motion";

export default function HeroSection() {
    return (
        <section className="relative overflow-hidden py-32 px-6 lg:px-12">
            {/* Minimalist Glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[600px] rounded-full opacity-10 blur-[120px] pointer-events-none"
                style={{ background: "var(--gradient-hero)" }} />

            <div className="max-w-[1500px] mx-auto text-left sm:text-center relative z-10 flex flex-col items-start sm:items-center">
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1 }}
                    className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-8"
                >
                    Haberleri{" "}
                    <span className="gradient-text">Yapay Zeka</span>{" "}
                    ile Keşfet
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="text-lg sm:text-2xl text-[var(--text-secondary)] font-light max-w-3xl mb-12 sm:text-center text-left"
                >
                    Makine öğrenmesi ile kategorize edilen, duygu ayrımına tabi tutulan ve akıllıca sentezlenen yeni nesil haber akışı.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                >
                    <a href="#news" className="px-10 py-4 rounded-2xl text-base font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-xl inline-block"
                        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}>
                        Haberlere Göz At
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
