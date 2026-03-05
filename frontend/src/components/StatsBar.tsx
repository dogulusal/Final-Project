"use client";

import { motion } from "framer-motion";

interface Props {
    newsCount: number;
}

const stats = [
    { label: "Kaynak", value: "12+", icon: "📡" },
    { label: "Kategori", value: "7", icon: "🏷️" },
    { label: "ML Doğruluğu", value: "%87", icon: "🤖" },
    { label: "Günlük Haber", value: "100+", icon: "📰" },
];

export default function StatsBar({ newsCount }: Props) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="glass-card px-5 py-4 flex items-center gap-3"
                    >
                        <span className="text-2xl">{stat.icon}</span>
                        <div>
                            <div className="text-xl font-bold text-[var(--text-primary)]">
                                {stat.label === "Günlük Haber" && newsCount > 0 ? newsCount : stat.value}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
