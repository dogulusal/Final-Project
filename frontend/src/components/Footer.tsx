"use client";

import Link from "next/link";

export default function Footer() {
    return (
        <footer className="mt-16 py-10 px-4 sm:px-6 lg:px-8" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="max-w-7xl w-full mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                                style={{ background: "var(--gradient-hero)" }}>
                                📡
                            </div>
                            <span className="font-bold text-base">
                                <span className="gradient-text">AI</span> Haber Ajansı
                            </span>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">
                            Yapay zeka destekli, otomatik haber toplama ve sentezleme platformu.
                        </p>
                    </div>

                    {/* Tech Stack */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-[var(--text-secondary)]">Teknoloji</h4>
                        <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                            <li>🤖 Naive Bayes ML</li>
                            <li>🧠 Gemini AI</li>
                            <li>⚙️ RSS Otomasyonu</li>
                            <li>🎨 Next.js + Tailwind</li>
                        </ul>
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-[var(--text-secondary)]">Bağlantılar</h4>
                        <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                            <li><Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link></li>
                            <li><Link href="/kategoriler" className="hover:text-[var(--text-primary)] transition-colors">Kategoriler</Link></li>
                            <li><Link href="/hakkinda" className="hover:text-[var(--text-primary)] transition-colors">Proje Hakkında</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="text-center text-[11px] text-[var(--text-muted)] pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    © {new Date().getFullYear()} AI Haber Ajansı — Final Projesi
                </div>
            </div>
        </footer>
    );
}
