import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "AI Haber Ajansı — Yapay Zeka Destekli Haber Platformu",
  description: "Türkiye'nin ilk yapay zeka destekli haberleri otomatik toplayan, kategorize eden ve özgünleştiren haber platformu.",
  keywords: ["yapay zeka", "haber", "AI", "machine learning", "Türkiye"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased select-none" suppressHydrationWarning>
        <ThemeProvider>
          <div className="animated-bg" />
          {children}
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
