"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <motion.nav
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="glass sticky top-0 z-50"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                            style={{ background: "var(--gradient-hero)" }}>
                            📡
                        </div>
                        <span className="text-lg font-bold tracking-tight">
                            <span className="gradient-text">AI</span>{" "}
                            <span className="text-[var(--text-primary)]">Haber Ajansı</span>
                        </span>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-6">
                        <NavLink href="/" label="Ana Sayfa" active />
                        <NavLink href="/kategoriler" label="Kategoriler" />
                        <NavLink href="/hakkinda" label="Hakkında" />
                        <button className="ml-4 px-5 py-2 rounded-xl text-sm font-medium text-white transition-all duration-300 hover:scale-105"
                            style={{ background: "var(--gradient-hero)" }}>
                            Dashboard
                        </button>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Menü aç/kapat"
                    >
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {menuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu */}
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="md:hidden pb-4 flex flex-col gap-3"
                    >
                        <NavLink href="/" label="Ana Sayfa" active />
                        <NavLink href="/kategoriler" label="Kategoriler" />
                        <NavLink href="/hakkinda" label="Hakkında" />
                    </motion.div>
                )}
            </div>
        </motion.nav>
    );
}

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
    return (
        <a
            href={href}
            className={`text-sm font-medium transition-colors duration-200 ${active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
        >
            {label}
        </a>
    );
}
