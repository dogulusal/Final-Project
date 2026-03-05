"use client";

import { motion } from "framer-motion";

interface Props {
    categories: string[];
    activeCategory: string;
    onCategoryChange: (cat: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    "Tümü": "🔥",
    "Spor": "⚽",
    "Ekonomi": "💰",
    "Teknoloji": "💻",
    "Siyaset": "🏛️",
    "Dünya": "🌍",
    "Sağlık": "🏥",
    "Genel": "📰",
};

export default function CategoryFilter({ categories, activeCategory, onCategoryChange }: Props) {
    return (
        <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
                <motion.button
                    key={cat}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onCategoryChange(cat)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${activeCategory === cat
                            ? "text-white shadow-lg"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                    style={{
                        background: activeCategory === cat ? "var(--gradient-hero)" : "var(--bg-card)",
                        border: `1px solid ${activeCategory === cat ? "transparent" : "var(--border-subtle)"}`,
                    }}
                >
                    <span className="mr-1.5">{CATEGORY_ICONS[cat] || "📄"}</span>
                    {cat}
                </motion.button>
            ))}
        </div>
    );
}
