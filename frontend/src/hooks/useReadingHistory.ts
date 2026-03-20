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
        const consent = localStorage.getItem(CONSENT_KEY) === "true";
        const enabled = localStorage.getItem(PERSONALIZATION_KEY) === "true";
        setIsPersonalized(consent && enabled);
    }, []);

    const recordClick = useCallback((categoryId: number) => {
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
