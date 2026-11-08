"use client";

import { useEffect } from "react";

// Menggantikan root layout saat layout itu sendiri gagal, jadi harus membawa <html> dan <body>
// dan tidak bisa mengandalkan stylesheet atau komponen layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Terjadi kesalahan</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>Aplikasi gagal dimuat. Silakan coba lagi.</p>
        {error.digest && <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>Kode galat: {error.digest}</p>}
        <button type="button" onClick={reset} style={{ padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
          Coba lagi
        </button>
      </body>
    </html>
  );
}
