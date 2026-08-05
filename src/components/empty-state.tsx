import { BarChart2 } from "lucide-react";

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
        <p className="text-sm text-muted-foreground italic">{title ?? "Belum ada data"}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <BarChart2 className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{title ?? "Belum ada data"}</p>
        <p className="text-muted-foreground text-sm mt-0.5">
          {description ?? "Data akan muncul setelah diisi melalui halaman Admin."}
        </p>
      </div>
    </div>
  );
}
