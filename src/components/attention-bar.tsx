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
    <div className="divide-y rounded-lg border">
      {redKPIs.length > 0 && (
        <Row
          icon={<AlertTriangle className={cn("h-4 w-4 shrink-0", statusConfig.red.color)} />}
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
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs underline-offset-2 hover:bg-accent hover:underline"
            >
              <span className="font-medium">{kpi.name}</span>
              <span className="num text-muted-foreground">
                {latestEntry ? formatValue(latestEntry.value, kpi.unit) : "—"}
                {" / "}
                {formatValue((effectiveTarget ?? kpi).target, kpi.unit)}
              </span>
            </Link>
          ))}
          {redKPIs.length > MAX_NAMED && (
            <Link
              href="/?status=red"
              className="px-1.5 py-0.5 text-xs text-muted-foreground underline underline-offset-2"
            >
              +{redKPIs.length - MAX_NAMED} lainnya
            </Link>
          )}
        </Row>
      )}

      {missingKPIs.length > 0 && (
        <Row
          icon={<CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />}
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
              className="rounded-md px-1.5 py-0.5 text-xs underline-offset-2 hover:bg-accent hover:underline"
            >
              {kpi.name}
            </Link>
          ))}
          {missingKPIs.length > MAX_NAMED && (
            <span className="px-1.5 text-xs text-muted-foreground">
              +{missingKPIs.length - MAX_NAMED} lainnya
            </span>
          )}
          {canEdit && (
            <Link
              href={`/admin/input?period=${period}`}
              className="ml-auto shrink-0 px-1.5 py-0.5 text-xs font-medium underline underline-offset-2"
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
      <span className="flex shrink-0 items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="flex flex-1 flex-wrap items-center gap-1">{children}</span>
    </div>
  );
}
