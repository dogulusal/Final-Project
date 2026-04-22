"use client";

import SentimentCell from "@/components/stats/SentimentCell";
import ModelCell from "@/components/stats/ModelCell";
import TodayCell from "@/components/stats/TodayCell";
import InterestCell from "@/components/stats/InterestCell";

export default function StatsBar() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <SentimentCell />
      <ModelCell />
      <TodayCell />
      <InterestCell />
    </div>
  );
}
