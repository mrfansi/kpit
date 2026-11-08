"use client";

import { RouteError } from "@/components/route-error";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Terjadi kesalahan" message="Gagal memuat halaman. Silakan coba lagi." />;
}
