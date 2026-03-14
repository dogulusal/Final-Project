import { ReactNode } from "react";
import CategorySidebar from "@/widgets/Sidebar/CategorySidebar";

interface DashboardShellProps {
    children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
    return (
        <div className="w-full flex-grow bg-[var(--bg-primary)]">
            <main className="grid grid-cols-1 lg:grid-cols-12 max-w-[1440px] w-full mx-auto gap-4 lg:gap-6 px-4 py-6 lg:py-10 min-h-[calc(100vh-80px)]">
                {/* Sidebar - hidden on mobile, takes 4 cols on lg */}
                <aside className="hidden lg:block lg:col-span-4 border-r-0 lg:border-r border-[var(--border-subtle)] pr-0 lg:pr-6">
                    <CategorySidebar />
                </aside>

                {/* Main Content Area - takes full width on mobile/tablet, remaining 8 cols on desktop */}
                <section className="lg:col-span-8 col-span-1">
                    {children}
                </section>
            </main>
        </div>
    );
}
