"use client";

import { ReactNode } from "react";
import { useInView } from "@/hooks/useInView";

interface LazySectionProps {
  children: ReactNode;
  /** Minimum height to reserve while the content is not yet visible (prevents layout shift). */
  minHeight?: string;
  className?: string;
}

/**
 * Wraps children in an IntersectionObserver — the children are only mounted
 * once the container scrolls into the viewport (+ 100 px early margin).
 * This keeps heavy widgets off the initial render path.
 */
export default function LazySection({ children, minHeight = "200px", className }: LazySectionProps) {
  const { ref, inView } = useInView();

  return (
    <div ref={ref} style={{ minHeight: inView ? undefined : minHeight }} className={className}>
      {inView ? children : null}
    </div>
  );
}
