import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1a2e",
};

export const metadata: Metadata = {
  title: "StockPulse - 실시간 주식 대시보드",
  description: "한국투자증권 API 기반 실시간 주식 시세 모니터링 대시보드",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StockPulse",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex overflow-x-hidden">
        <TooltipProvider>
          {/* 데스크톱: 사이드바 / 모바일: 숨김 */}
          <div className="hidden md:block">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-auto w-full">
            {children}
          </main>
          {/* 모바일 전용 하단 탭 바 */}
          <MobileNav />
        </TooltipProvider>
      </body>
    </html>
  );
}
