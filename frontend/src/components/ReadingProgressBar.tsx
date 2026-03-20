"use client";

import { useState, useEffect } from "react";

export default function ReadingProgressBar({ targetId }: { targetId?: string }) {
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const updateScroll = () => {
      let currentScroll = 0;
      let scrollHeight = 0;

      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          currentScroll = el.scrollTop;
          scrollHeight = el.scrollHeight - el.clientHeight;
        }
      } else {
        currentScroll = window.scrollY;
        scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      }
      
      if (scrollHeight > 0) {
        setReadingProgress(Number((currentScroll / scrollHeight).toFixed(2)) * 100);
      } else {
        setReadingProgress(0);
      }
    };

    const targetElement = targetId ? document.getElementById(targetId) : window;
    if (targetElement) {
        targetElement.addEventListener("scroll", updateScroll, { passive: true });
        updateScroll(); // initial
    }

    return () => {
        if (targetElement) {
            targetElement.removeEventListener("scroll", updateScroll);
        }
    };
  }, [targetId]);

  return (
    <div className="fixed top-0 left-0 w-full h-[3px] bg-transparent z-[100]">
      <div 
        className="h-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-blue)] transition-all duration-150 ease-out" 
        style={{ width: `${readingProgress}%` }}
      />
    </div>
  );
}
