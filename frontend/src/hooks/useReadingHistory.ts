"use client";

import { useEffect, useState, useCallback } from "react";

const HISTORY_KEY = "news_reading_history";
const CONSENT_KEY = "kvkk_consent";
const PERSONALIZATION_KEY = "personalization_enabled";
const MAX_HISTORY = 50;

export interface CategoryHistory {
    categoryId: number;
    timestamp: number;
}

export function useReadingHistory() {
    const [isPersonalized, setIsPersonalized] = useState(false);

    useEffect(() => {
        // localStorage sadece client-side'da mevcut
        if (typeof window === 'undefined') return;
        
        const consent = localStorage.getItem(CONSENT_KEY) === "true";
        const enabled = localStorage.getItem(PERSONALIZATION_KEY) === "true";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsPersonalized(consent && enabled); // reading localStorage in mount effect, no cascade risk
    }, []);

    const recordClick = useCallback((categoryId: number) => {
        if (typeof window === 'undefined') return;
        
        // Sadece kişiselleştirme aktifse kaydet
        const consent = localStorage.getItem(CONSENT_KEY) === "true";
        const enabled = localStorage.getItem(PERSONALIZATION_KEY) === "true";
        if (!consent || !enabled) return;

        const rawHistory = localStorage.getItem(HISTORY_KEY);
        let history: CategoryHistory[] = rawHistory ? JSON.parse(rawHistory) : [];

        // Yeni tıklamayı ekle
        history.unshift({ categoryId, timestamp: Date.now() });

        // Sınırla
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, []);

    const getInterests = useCallback(() => {
        if (typeof window === 'undefined') return {};
        
        const rawHistory = localStorage.getItem(HISTORY_KEY);
        if (!rawHistory) return {};

        const history: CategoryHistory[] = JSON.parse(rawHistory);
        const counts: Record<number, number> = {};

        history.forEach(item => {
            counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
        });

        return counts;
    }, []);

    return { recordClick, getInterests, isPersonalized };
}
