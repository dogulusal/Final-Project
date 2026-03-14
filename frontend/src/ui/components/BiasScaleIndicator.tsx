"use client";

import { motion } from "framer-motion";

interface Props {
  sentiment: string | null;
  confidence?: number;
}

export default function BiasScaleIndicator({ sentiment, confidence }: Props) {
  // sentiment: "Pozitif", "Negatif", "Nötr"
  let translatePercent = "50%";
  
  if (sentiment === "Pozitif") {
    translatePercent = "90%";
  } else if (sentiment === "Negatif") {
    translatePercent = "10%";
  }

  return (
    <div className="w-full flex items-center gap-4">
      <span className="text-[11px] text-[var(--accent-rose)] font-bold uppercase tracking-wider">Negatif</span>
      <div className="flex-grow h-2.5 rounded-full bg-gradient-to-r from-[var(--accent-rose)] via-gray-400 to-[var(--accent-emerald)] relative shadow-inner">
        <motion.div 
          initial={{ left: "50%" }}
          animate={{ left: translatePercent }}
          transition={{ duration: 1.2, type: "spring", stiffness: 50, damping: 10 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-[3px] border-[var(--bg-primary)] shadow-[0_0_10px_rgba(0,0,0,0.2)] bg-[var(--text-primary)]"
        />
      </div>
      <span className="text-[11px] text-[var(--accent-emerald)] font-bold uppercase tracking-wider">Pozitif</span>
    </div>
  );
}
