import { AlertTriangle, Clock, TrendingDown } from "lucide-react";
import type { KPIEarlyWarning } from "@/lib/kpi-warning";

interface KPIEarlyWarningProps {
  warning: KPIEarlyWarning | null;
}

// Sumur berwarna tanpa garis tepi: hue status hanya untuk tingkat yang memang peringatan.
const severityClass: Record<KPIEarlyWarning["severity"], string> = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warning-soft text-warning",
  low: "bg-paper-2 text-foreground",
};

export function KPIEarlyWarning({ warning }: KPIEarlyWarningProps) {
  if (!warning) return null;

  const Icon = warning.severity === "low" ? Clock : warning.severity === "medium" ? TrendingDown : AlertTriangle;

  return (
    <section className={`rounded-card px-5 py-4 ${severityClass[warning.severity]}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-1 size-4 shrink-0" />
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Early warning</h2>
            <p className="mt-1 text-sm">Sistem menyarankan action plan sebelum risiko KPI makin melebar.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {warning.reasons.map((reason) => (
              <li key={reason} className="rounded-sm bg-background/70 px-1.5 py-0.5 text-sm">
                {reason}
              </li>
            ))}
          </ul>
          <div className="text-sm">
            <p className="font-semibold">{warning.suggestedAction.title}</p>
            <p className="mt-1">{warning.suggestedAction.description}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
