import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { getAllDomains } from "@/lib/queries";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { ToastHandler } from "@/components/toast-handler";
import { AIChat } from "@/components/ai-chat";
import { auth } from "@/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KPI Dashboard",
  description: "Dashboard laporan Key Performance Indicators",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [domains, session] = await Promise.all([getAllDomains(), auth()]);

  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        <ThemeProvider>
        {/* Mobile header (hamburger + Sheet) — hanya tampil di < lg */}
        <MobileHeader domains={domains} isAuthenticated={!!session} userName={session?.user?.name ?? session?.user?.email} />

        <div className="flex min-h-screen">
          {/* Desktop sidebar — hidden di mobile */}
          <div className="hidden lg:block">
            <Sidebar domains={domains} user={session?.user} />
          </div>
          <main className="flex-1 overflow-auto min-w-0">
            <div className="p-4 lg:p-6 max-w-7xl mx-auto">{children}</div>
          </main>
        </div>

        <Toaster richColors position="top-right" />
        <Suspense><ToastHandler /></Suspense>
        {session && <AIChat />}
        </ThemeProvider>
      </body>
    </html>
  );
}
