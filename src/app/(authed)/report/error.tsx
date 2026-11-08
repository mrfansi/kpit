"use client";

import { RouteError } from "@/components/route-error";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Laporan gagal dimuat" message="Data KPI tidak berhasil dirangkum. Coba muat ulang; kalau tetap gagal, buka domainnya satu per satu dari Overview." homeHref="/" />;
}
