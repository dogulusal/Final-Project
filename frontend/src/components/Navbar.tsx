"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [visible, setVisible] = useState(true);
    const [lastY, setLastY] = useState(0);
    const [atTop, setAtTop] = useState(true);

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            setAtTop(y < 10);
            setVisible(y < lastY || y < 80);
            setLastY(y);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [lastY]);

    return (
        <motion.header
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)]"
            style={{
                transform: visible ? "translateY(0)" : "translateY(-100%)",
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, backdrop-filter 0.3s ease",
                background: atTop ? "var(--bg-primary)" : "var(--bg-glass)",
                backdropFilter: atTop ? "none" : "blur(16px)",
                WebkitBackdropFilter: atTop ? "none" : "blur(16px)",
            }}
        >
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                            style={{ background: "var(--gradient-brand)" }}>
                            📡
                        </div>
                        <span className="text-lg font-bold tracking-tight">
                            <span className="gradient-text">AI</span>{" "}
                            <span className="text-[var(--text-primary)]">Haber Ajansı</span>
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-6">
                        <NavLink href="/" label="Ana Sayfa" />
                        <NavLink href="/kategoriler" label="Kategoriler" />
                        <NavLink href="/hakkinda" label="Hakkında" />
                        <NavLink href="/admin" label="Yönetici Paneli" />
                        <ThemeToggle />
                    </div>

                    {/* Mobile Controls */}
                    <div className="flex md:hidden items-center gap-2">
                        <ThemeToggle />
                        <button
                            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden pb-4 flex flex-col gap-3 overflow-hidden"
                        >
                            <NavLink href="/" label="Ana Sayfa" />
                            <NavLink href="/kategoriler" label="Kategoriler" />
                            <NavLink href="/hakkinda" label="Hakkında" />
                            <NavLink href="/admin" label="Yönetici Paneli" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.header>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="text-sm font-medium transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
            {label}
        </Link>
    );
}
