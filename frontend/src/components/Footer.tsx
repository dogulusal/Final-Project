"use client";

import Link from "next/link";

export default function Footer() {
    return (
        <footer className="mt-20 py-12 px-6 lg:px-12" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="max-w-[1500px] w-full mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                style={{ background: "var(--gradient-hero)" }}>
                                📡
                            </div>
                            <span className="font-bold text-lg">
                                <span className="gradient-text">AI</span> Haber Ajansı
                            </span>
                        </div>
                        <p className="text-base text-[var(--text-muted)] leading-relaxed max-w-sm">
                            Türkiye&apos;nin yapay zeka destekli, otomatik haber toplama ve sentezleme platformu.
                        </p>
                    </div>

                    {/* Tech Stack */}
                    <div>
                        <h4 className="text-base font-semibold mb-4 text-[var(--text-secondary)]">Teknoloji Altyapısı</h4>
                        <ul className="space-y-3 text-sm text-[var(--text-muted)]">
                            <li>🤖 Naive Bayes ML Kategorisasyonu</li>
                            <li>🧠 LLM (Ollama/OpenAI) Özgünleştirme</li>
                            <li>📡 Otomatize Veri Toplama</li>
                            <li>🎨 Next.js Premium Önyüz</li>
                        </ul>
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="text-base font-semibold mb-4 text-[var(--text-secondary)]">Bağlantılar</h4>
                        <ul className="space-y-3 text-sm text-[var(--text-muted)]">
                            <li><Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link></li>
                            <li><Link href="/kategoriler" className="hover:text-[var(--text-primary)] transition-colors">Kategoriler</Link></li>
                            <li><Link href="/hakkinda" className="hover:text-[var(--text-primary)] transition-colors">Proje Hakkında</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="text-center text-xs text-[var(--text-muted)] pt-8" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    © {new Date().getFullYear()} AI Haber Ajansı — Final Projesi | Tüm hakları saklıdır.
                </div>
            </div>
        </footer>
    );
}
