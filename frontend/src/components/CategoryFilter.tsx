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
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
                        activeCategory === cat
                            ? "bg-[var(--accent-primary)] text-[var(--text-inverse)] border-transparent shadow-lg"
                            : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]"
                        }`}
                >
                    <span className="mr-1.5">{CATEGORY_ICONS[cat] || "📄"}</span>
                    {cat}
                </motion.button>
            ))}
        </div>
    );
}
