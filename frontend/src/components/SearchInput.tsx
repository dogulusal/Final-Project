"use client";

import { motion } from "framer-motion";

interface Props {
    value: string;
    onChange: (val: string) => void;
}

export default function SearchInput({ value, onChange }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md"
        >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Haberlerde ara..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent transition-all"
                style={{ color: "var(--text-primary)" }}
            />
        </motion.div>
    );
}
