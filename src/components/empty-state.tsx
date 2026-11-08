interface EmptyStateProps {
  title?: string;
  description?: string;
  /** Varian ringkas untuk konteks inline (mis. daftar di dalam kartu), tanpa ikon dan tanpa deskripsi fallback generik. */
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{title ?? "Belum ada data"}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
    );
  }

  // Tanpa ikon-dalam-ubin: kosong dinyatakan dengan kata, bukan dekorasi.
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-14 text-center">
      <p className="text-base font-semibold">{title ?? "Belum ada data"}</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        {description ?? "Data akan muncul setelah diisi melalui halaman Admin."}
      </p>
    </div>
  );
}
