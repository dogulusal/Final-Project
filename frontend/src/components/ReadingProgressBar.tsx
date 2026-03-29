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
        setReadingProgress(Math.round((currentScroll / scrollHeight) * 100));
      } else {
        setReadingProgress(0);
      }
    };

    const targetElement = targetId ? document.getElementById(targetId) : window;
    if (targetElement) {
      targetElement.addEventListener("scroll", updateScroll, { passive: true });
      updateScroll();
    }

    return () => {
      if (targetElement) {
        targetElement.removeEventListener("scroll", updateScroll);
      }
    };
  }, [targetId]);

  const isFinished = readingProgress >= 98;

  return (
    <>
      {/* Progress bar — sticky top */}
      <div
        className="fixed top-0 left-0 w-full z-[200] pointer-events-none"
        role="progressbar"
        aria-valuenow={readingProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Okuma ilerlemesi"
      >
        <div className="h-[3px] bg-transparent">
          <div
            className={`h-full transition-all duration-150 ease-out ${
              isFinished
                ? "bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)]"
                : "bg-gradient-to-r from-[var(--accent-warm)] via-[var(--accent-purple)] to-[var(--accent-blue)]"
            }`}
            style={{ width: `${readingProgress}%` }}
          />
        </div>
      </div>

      {/* Floating percentage badge — appears after 5% */}
      {readingProgress > 5 && (
        <div
          className={`fixed bottom-6 right-6 z-[199] transition-all duration-300 ${
            readingProgress > 5 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="relative w-11 h-11 flex items-center justify-center">
            {/* SVG circle progress */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="3"
              />
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke={isFinished ? "var(--accent-green)" : "var(--accent-warm)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - readingProgress / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className={`relative text-[10px] font-bold ${isFinished ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"}`}>
              {isFinished ? "✓" : `${readingProgress}%`}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


