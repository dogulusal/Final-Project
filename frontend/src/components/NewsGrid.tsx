"use client";

import { motion } from "framer-motion";
import type { NewsItem } from "@/app/page";
import NewsCard from "./NewsCard";

interface Props {
    news: NewsItem[];
    loading: boolean;
}

export default function NewsGrid({ news, loading }: Props) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" id="news">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="glass-card p-5 animate-pulse">
                        <div className="h-3 w-16 rounded-full mb-4" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-5 w-full rounded mb-2" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-5 w-3/4 rounded mb-4" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-3 w-full rounded mb-1" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-3 w-2/3 rounded" style={{ background: "var(--bg-card-hover)" }} />
                    </div>
                ))}
            </div>
        );
    }

    if (news.length === 0) {
        return (
            <div className="glass-card p-10 text-center" id="news">
                <span className="text-3xl mb-3 block">📭</span>
                <h3 className="text-lg font-semibold mb-1">Henüz haber bulunamadı</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                    n8n workflow&apos;ları aktifleştirildiğinde haberler otomatik olarak burada görünecek.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" id="news">
            {news.map((item, index) => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                >
                    <NewsCard news={item} />
                </motion.div>
            ))}
        </div>
    );
}
