"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Membaca ?success= atau ?error= dari URL dan menampilkan toast,
 * lalu menghapus param dari URL agar tidak muncul lagi saat refresh.
 */
export function ToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast.success(decodeURIComponent(success));
      // Hapus param dari URL tanpa reload
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState(null, "", url.toString());
    }

    if (error) {
      toast.error(decodeURIComponent(error));
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState(null, "", url.toString());
    }
  }, [searchParams]);

  return null;
}
