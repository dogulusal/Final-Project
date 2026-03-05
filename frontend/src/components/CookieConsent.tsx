"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem("kvkk_consent");
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const acceptCookies = () => {
        localStorage.setItem("kvkk_consent", "true");
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="fixed bottom-0 left-0 right-0 z-[100] p-4 flex justify-center w-full"
                >
                    <div className="glass-card max-w-4xl w-full p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 shadow-2xl"
                        style={{ border: "1px solid var(--border-subtle)" }}>
                        <div className="flex-1 text-sm text-[var(--text-secondary)]">
                            <h4 className="font-bold text-[var(--text-primary)] mb-1">🍪 KVKK ve Çerez Politikası</h4>
                            Sitemiz ziyaretçi deneyimini iyileştirmek ve kişiselleştirilmiş hizmet sunabilmek için çerezler (cookies) kullanmaktadır. Siteyi kullanmaya devam ederek gizlilik ve çerez politikamızı kabul etmiş olursunuz.
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={acceptCookies}
                                className="w-full md:w-auto px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:scale-105"
                                style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
                            >
                                Tümünü Kabul Et
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
