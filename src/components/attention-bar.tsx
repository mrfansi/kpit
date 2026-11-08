import Link from "next/link";
import { AlertTriangle, CircleDashed } from "lucide-react";
import { formatValue } from "@/lib/period";
import { statusConfig } from "@/lib/kpi-status";
import { cn } from "@/lib/utils";
import type { KPI, KPIEntry } from "@/lib/db/schema";

interface AttentionBarProps {
  redKPIs: {
    kpi: KPI;
    latestEntry: KPIEntry | null;
    domainName: string;
    effectiveTarget?: { target: number };
  }[];
  missingKPIs: KPI[];
  period: string;
  /** Pintasan "Isi sekaligus" menuju /admin/input — viewer akan dipantulkan. */
  canEdit?: boolean;
}

const MAX_NAMED = 4;

/**
 * Menggantikan dua kotak berwarna besar (alert off-track + tracker kelengkapan)
 * dengan dua baris ringkas. Keduanya menjawab satu pertanyaan yang sama —
 * "apa yang harus saya kerjakan?" — jadi tempatnya berdampingan, bukan menumpuk
 * jadi dua panel yang mendorong data asli turun ke bawah layar.
 */
export function AttentionBar({ redKPIs, missingKPIs, period, canEdit = false }: AttentionBarProps) {
  if (redKPIs.length === 0 && missingKPIs.length === 0) return null;

  return (
    // Sumur bertinta tanpa border: rung yang berbeda dari garis readout di atasnya
    // dan dari tabel di bawahnya.
    <div className="divide-y divide-border rounded-card bg-paper-2 px-4">
      {redKPIs.length > 0 && (
        <Row
          icon={<AlertTriangle aria-hidden className={cn("size-4 shrink-0", statusConfig.red.color)} />}
          label={
            <span className={statusConfig.red.color}>
              <span className="num font-semibold">{redKPIs.length}</span> off track
            </span>
          }
        >
          {redKPIs.slice(0, MAX_NAMED).map(({ kpi, latestEntry, effectiveTarget }) => (
            <Link
              key={kpi.id}
              href={`/kpi/${kpi.id}`}
              className="inline-flex items-baseline gap-1.5 rounded-sm px-1.5 py-0.5 text-sm underline-offset-4 transition-colors duration-[var(--dur-micro)] hover:bg-accent hover:underline"
            >
              <span className="font-semibold">{kpi.name}</span>
              <span className="num text-muted-foreground">
                {latestEntry ? formatValue(latestEntry.value, kpi.unit) : "-"}
                {" / "}
                {formatValue((effectiveTarget ?? kpi).target, kpi.unit)}
              </span>
            </Link>
          ))}
          {redKPIs.length > MAX_NAMED && (
            <Link
              href="/?status=red"
              className="px-1.5 py-0.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              +{redKPIs.length - MAX_NAMED} lainnya
            </Link>
          )}
        </Row>
      )}

      {missingKPIs.length > 0 && (
        <Row
          icon={<CircleDashed aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
          label={
            <span className="text-muted-foreground">
              <span className="num font-semibold text-foreground">{missingKPIs.length}</span> belum
              diisi
            </span>
          }
        >
          {missingKPIs.slice(0, MAX_NAMED).map((kpi) => (
            <Link
              key={kpi.id}
              href={`/kpi/${kpi.id}`}
              className="rounded-sm px-1.5 py-0.5 text-sm underline-offset-4 transition-colors duration-[var(--dur-micro)] hover:bg-accent hover:underline"
            >
              {kpi.name}
            </Link>
          ))}
          {missingKPIs.length > MAX_NAMED && (
            <span className="px-1.5 text-sm text-muted-foreground">
              +{missingKPIs.length - MAX_NAMED} lainnya
            </span>
          )}
          {canEdit && (
            <Link
              href={`/admin/input?period=${period}`}
              className="ml-auto shrink-0 px-1.5 py-0.5 text-sm font-semibold underline underline-offset-4"
            >
              Isi sekaligus
            </Link>
          )}
        </Row>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-x-4 gap-y-1.5 py-3 text-sm sm:flex-row sm:items-baseline">
      <span className="flex shrink-0 items-center gap-2 sm:w-36">
        <span className="self-center">{icon}</span>
        {label}
      </span>
      <span className="flex flex-1 flex-wrap items-baseline gap-x-1 gap-y-1">{children}</span>
    </div>
  );
}
