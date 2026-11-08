import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { getAllDomains } from "@/lib/queries";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { ToastHandler } from "@/components/toast-handler";
import { auth } from "@/auth";

// Satu keluarga variabel: teks, judul dan angka readout semuanya IBM Plex Sans.
const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], display: "swap" });
// Outlier dengan satu peran: kode.
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400"], display: "swap" });

export const metadata: Metadata = {
  title: "KPI Dashboard",
  description: "Dashboard laporan Key Performance Indicators",
};

// Every page reads D1, which only exists per request on Workers; skip build-time prerendering.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Anonymous visitors (login, not-found) get a bare shell: no domain query, no data-bearing navigation.
  const domains = session?.user ? await getAllDomains() : [];

  return (
    // Variabel font di <html>, bukan <body>: token --font-body dideklarasikan di :root dan
    // harus bisa me-resolve var(--font-plex-sans) di elemen yang sama.
    <html lang="id" className={`${plexSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
        <a
          href="#main"
          className="sr-only z-[var(--z-toast)] rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3"
        >
          Lewati ke konten
        </a>
        {session?.user ? (
          <>
            {/* Mobile header (hamburger + Sheet) — hanya tampil di < lg */}
            <MobileHeader domains={domains} isAuthenticated userName={session.user.name ?? session.user.email} role={session.user.role} />

            <div className="flex min-h-screen">
              {/* Desktop sidebar — hidden di mobile */}
              <div className="hidden w-60 shrink-0 lg:block print:hidden">
                <Sidebar domains={domains} user={session.user} />
              </div>
              <main id="main" className="flex-1 overflow-auto min-w-0">
                <div className="mx-auto max-w-7xl px-4 py-6 lg:px-10 lg:py-8">{children}</div>
              </main>
            </div>
          </>
        ) : (
          <main id="main" className="min-h-screen">
            {children}
          </main>
        )}

        <Toaster richColors position="top-right" />
        <Suspense><ToastHandler /></Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
