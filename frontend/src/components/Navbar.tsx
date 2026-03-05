"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <motion.nav
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="glass sticky top-0 z-50 w-full"
        >
            <div className="max-w-[1500px] w-full mx-auto px-6 lg:px-12">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                            style={{ background: "var(--gradient-hero)" }}>
                            📡
                        </div>
                        <span className="text-xl font-bold tracking-tight">
                            <span className="gradient-text">AI</span>{" "}
                            <span className="text-[var(--text-primary)]">Haber Ajansı</span>
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        <NavLink href="/" label="Ana Sayfa" />
                        <NavLink href="/kategoriler" label="Kategoriler" />
                        <NavLink href="/hakkinda" label="Hakkında" />
                        <Link href="http://localhost:5678" target="_blank" rel="noopener noreferrer"
                            className="ml-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-105"
                            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}>
                            n8n Dashboard
                        </Link>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Menü aç/kapat"
                    >
                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="md:hidden pb-6 flex flex-col gap-4"
                    >
                        <NavLink href="/" label="Ana Sayfa" />
                        <NavLink href="/kategoriler" label="Kategoriler" />
                        <NavLink href="/hakkinda" label="Hakkında" />
                    </motion.div>
                )}
            </div>
        </motion.nav>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="text-base font-medium transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
            {label}
        </Link>
    );
}
