"use client";

import { RouteError } from "@/components/route-error";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Gagal memuat KPI" message="Terjadi kesalahan saat memuat data KPI. Silakan coba lagi." homeHref="/" />;
}
