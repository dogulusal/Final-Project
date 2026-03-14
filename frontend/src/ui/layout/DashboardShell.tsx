import { ReactNode } from "react";

interface DashboardShellProps {
    children: ReactNode;
}

/**
 * DashboardShell — AntiGravity v3
 *
 * Full-width editorial layout. Sidebar removed in favor of inline
 * horizontal category tabs (handled by CategoryFilter in each page).
 * Clean max-width container with responsive padding.
 */
export default function DashboardShell({ children }: DashboardShellProps) {
    return (
        <div className="w-full min-h-screen" style={{ background: "var(--bg-primary)" }}>
            <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-10">
                {children}
            </main>
        </div>
    );
}
