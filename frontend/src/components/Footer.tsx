"use client";

export default function Footer() {
    return (
        <footer className="mt-20 py-12 px-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                                style={{ background: "var(--gradient-hero)" }}>
                                📡
                            </div>
                            <span className="font-bold">
                                <span className="gradient-text">AI</span> Haber Ajansı
                            </span>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                            Türkiye&apos;nin ilk yapay zeka destekli haber toplama, kategorize etme
                            ve özgünleştirme platformu.
                        </p>
                    </div>

                    {/* Tech Stack */}
                    <div>
                        <h4 className="text-sm font-semibold mb-4 text-[var(--text-secondary)]">Teknoloji Altyapısı</h4>
                        <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                            <li>🤖 Naive Bayes ML Kategorisasyonu</li>
                            <li>🧠 LLM İçerik Özgünleştirme</li>
                            <li>📡 RSS Otomatik Haber Toplama</li>
                            <li>🎨 Canvas Görsel Oluşturma</li>
                        </ul>
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="text-sm font-semibold mb-4 text-[var(--text-secondary)]">Bağlantılar</h4>
                        <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                            <li><a href="https://github.com/dogulusal/Final-Project" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-blue)] transition-colors">GitHub Repo</a></li>
                            <li><a href="/hakkinda" className="hover:text-[var(--accent-blue)] transition-colors">Proje Hakkında</a></li>
                            <li><a href="http://localhost:5678" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-blue)] transition-colors">n8n Dashboard</a></li>
                        </ul>
                    </div>
                </div>

                <div className="text-center text-xs text-[var(--text-muted)] pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    © {new Date().getFullYear()} AI Haber Ajansı — Final Projesi | Tüm hakları saklıdır.
                </div>
            </div>
        </footer>
    );
}
