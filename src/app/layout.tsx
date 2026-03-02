import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { getAllDomains } from "@/lib/queries";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { ToastHandler } from "@/components/toast-handler";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KPI Dashboard",
  description: "Dashboard laporan Key Performance Indicators",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const domains = await getAllDomains();

  return (
    <html lang="id">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="flex min-h-screen">
          <Sidebar domains={domains} />
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
        <Toaster richColors position="top-right" />
        <Suspense><ToastHandler /></Suspense>
      </body>
    </html>
  );
}
