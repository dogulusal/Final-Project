import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import { ThemeProvider } from "@/components/ThemeProvider";
import DashboardShell from "@/ui/layout/DashboardShell";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "AI Haber Ajansı — Yapay Zeka Destekli Haber Platformu",
  description: "Türkiye'nin ilk yapay zeka destekli haberleri otomatik toplayan, kategorize eden ve özgünleştiren haber platformu.",
  keywords: ["yapay zeka", "haber", "AI", "machine learning", "Türkiye"],
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={cn("font-sans", dmSans.variable, dmSerifDisplay.variable)}
    >
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <div className="animated-bg" />
          <DashboardShell>
            {children}
          </DashboardShell>
          {modal}
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
