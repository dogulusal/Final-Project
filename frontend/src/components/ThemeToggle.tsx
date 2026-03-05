"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="w-10 h-10" />; // skeleton width to prevent layout shift
    }

    const isDark = theme === "dark";

    return (
        <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            aria-label="Temayı Değiştir"
        >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </motion.button>
    );
}
