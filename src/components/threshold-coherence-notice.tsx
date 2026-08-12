import { AlertTriangle } from "lucide-react";
import { checkThresholdCoherence } from "@/lib/kpi-coherence";
import { cn } from "@/lib/utils";

/**
 * Target dan threshold adalah dua definisi "bagus" yang berdiri sendiri: status
 * dihitung dari threshold, pencapaian dari target. Kalau keduanya melenceng jauh,
 * KPI bisa tampil "On Track" sambil memampangkan pencapaian 10% di sebelahnya.
 *
 * Isu `warning` TIDAK memblokir — toleransi longgar kadang memang disengaja.
 * Isu `error` (urutan hijau/kuning terbalik) ditolak juga oleh server, jadi
 * komponen ini dipakai di setiap form yang menulis threshold supaya penolakan
 * itu terlihat sebelum tombol simpan ditekan, bukan sesudahnya.
 */
export function ThresholdCoherenceNotice({
  direction,
  target,
  thresholdGreen,
  thresholdYellow,
}: {
  direction?: string;
  target?: number;
  thresholdGreen?: number;
  thresholdYellow?: number;
}) {
  if (
    typeof target !== "number" ||
    typeof thresholdGreen !== "number" ||
    typeof thresholdYellow !== "number"
  ) {
    return null;
  }

  const issues = checkThresholdCoherence({
    direction: direction === "lower_better" ? "lower_better" : "higher_better",
    target,
    thresholdGreen,
    thresholdYellow,
  });

  if (issues.length === 0) return null;

  return (
    <div className="space-y-2" role="status">
      {issues.map((issue, i) => (
        <p
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-md border p-3 text-xs",
            issue.level === "error"
              ? "border-danger bg-danger-soft text-danger"
              : "border-warning bg-warning-soft text-warning"
          )}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{issue.message}</span>
        </p>
      ))}
    </div>
  );
}
