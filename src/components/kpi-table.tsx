import { differenceInMonths, parseISO } from "date-fns";
import { toJakartaDateOnly } from "@/lib/date-utils";
import { EmptyState } from "@/components/empty-state";
import { KPITableRows, type KPIRow } from "@/components/kpi-table-rows";
import type { KPI, KPIEntry } from "@/lib/db/schema";

export interface KPIRowData {
  kpi: KPI;
  latestEntry: KPIEntry | null;
  sparklineEntries?: KPIEntry[];
  effectiveTarget?: { target: number; thresholdGreen: number; thresholdYellow: number };
}

interface KPITableProps {
  rows: KPIRowData[];
  actionCounts: Map<number, number>;
  emptyMessage: string;
  /**
   * Periode yang sedang dilihat. Nilai KPI diambil dari entry terakhir
   * pada-atau-sebelum periode ini, jadi angkanya bisa berasal dari periode lain —
   * kalau itu terjadi, periode asalnya harus ditulis, bukan disembunyikan.
   */
  selectedPeriod?: string;
  /** Tombol pin hanya untuk admin; bagi viewer aksinya dijamin ditolak server. */
  canEdit?: boolean;
}

const STALE_THRESHOLD_MONTHS = 2;


/**
 * Satu KPI per baris. Menggantikan grid kartu: pada layar yang sama muat jauh
 * lebih banyak KPI, dan yang lebih penting — angkanya berbaris dalam kolom,
 * jadi bisa dibandingkan dengan menyapu mata ke bawah, bukan melompat antar kartu.
 *
 * Wrapper server: hanya menyerahkan field minimal ke komponen klien supaya payload RSC kecil.
 */
export function KPITable({
  rows,
  actionCounts,
  emptyMessage,
  selectedPeriod,
  canEdit = false,
}: KPITableProps) {
  if (rows.length === 0) {
    return <EmptyState compact title={emptyMessage} />;
  }

  const today = parseISO(toJakartaDateOnly());
  const data: KPIRow[] = rows.map(({ kpi, latestEntry, sparklineEntries = [], effectiveTarget }) => {
    const t = effectiveTarget ?? kpi;
    return {
      id: kpi.id,
      name: kpi.name,
      description: kpi.description,
      unit: kpi.unit,
      direction: kpi.direction,
      isPinned: kpi.isPinned,
      target: t.target,
      thresholdGreen: t.thresholdGreen,
      thresholdYellow: t.thresholdYellow,
      latest: latestEntry ? { value: latestEntry.value, periodDate: latestEntry.periodDate } : null,
      sparkline: sparklineEntries.map(({ value }) => ({ value })),
      actionCount: actionCounts.get(kpi.id) ?? 0,
      isStale: latestEntry
        ? differenceInMonths(today, parseISO(latestEntry.periodDate)) >= STALE_THRESHOLD_MONTHS
        : false,
    };
  });

  return <KPITableRows rows={data} selectedPeriod={selectedPeriod} canEdit={canEdit} />;
}
