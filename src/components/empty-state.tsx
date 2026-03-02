import { BarChart2 } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "Belum ada data",
  description = "Data akan muncul setelah diisi melalui halaman Admin.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <BarChart2 className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
    </div>
  );
}
