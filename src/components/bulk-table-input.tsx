"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Save } from "lucide-react";
import { formatValue, listLastNMonths } from "@/lib/period";
import { bulkCreateEntries } from "@/lib/actions/entry";
import { DataEntryValidator } from "@/components/data-entry-validator";
import { getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { cn } from "@/lib/utils";
import type { KPI, KPIEntry, Domain } from "@/lib/db/schema";

interface TargetOverride {
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}

interface BulkTableInputProps {
  kpis: KPI[];
  domains: Domain[];
  initialPeriod: string;
  existingEntries: KPIEntry[];
  /** Target override per KPI id for this period; KPIs without one use their default. */
  overrides: Record<number, TargetOverride>;
  /** Value of the month before this period, per KPI id. */
  previousValues: Record<number, number>;
}

export function BulkTableInput({ kpis, domains, initialPeriod, existingEntries, overrides, previousValues }: BulkTableInputProps) {
  const months = listLastNMonths(12);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Derive values/notes from existingEntries prop (server-provided, updates on navigation)
  const [values, setValues] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const e of existingEntries) map[e.kpiId] = String(e.value);
    return map;
  });
  const [notes, setNotes] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const e of existingEntries) if (e.note) map[e.kpiId] = e.note;
    return map;
  });

  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  function handlePeriodChange(newPeriod: string) {
    router.push(`/admin/input?period=${newPeriod}`);
  }

  function handleSave() {
    const rows = kpis
      .filter((kpi) => values[kpi.id] !== undefined && values[kpi.id] !== "")
      .map((kpi) => ({
        kpiId: kpi.id,
        periodDate: initialPeriod,
        value: parseFloat(values[kpi.id]),
        note: notes[kpi.id] || undefined,
      }))
      .filter((r) => !isNaN(r.value));

    if (rows.length === 0) {
      toast.error("Belum ada nilai yang diisi");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkCreateEntries(rows);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success(`${result.saved} data berhasil disimpan`);
        setSavedAt(new Date().toLocaleTimeString("id-ID"));
      } catch {
        toast.error("Gagal menyimpan data");
      }
    });
  }

  const filledCount = kpis.filter((k) => values[k.id] !== undefined && values[k.id] !== "").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor="bulk-period" className="text-sm text-muted-foreground">Periode</label>
          <Select value={initialPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger id="bulk-period" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="num font-semibold text-foreground">{filledCount}/{kpis.length}</span> diisi
        </p>
      </div>

      {/* Buku besar: tabel polos, satu KPI per baris, sel isian di kolom angka. */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-0">KPI</TableHead>
            <TableHead className="hidden md:table-cell">Domain</TableHead>
            <TableHead className="hidden md:table-cell">Unit</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Target</TableHead>
            <TableHead className="hidden text-right md:table-cell">Bulan lalu</TableHead>
            <TableHead className="w-36 text-right">Nilai aktual</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="hidden w-56 pr-0 sm:table-cell">Catatan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {kpis.map((kpi) => {
            const domain = domainMap[kpi.domainId];
            const isEmpty = values[kpi.id] === undefined || values[kpi.id] === "";
            const override = overrides[kpi.id];
            const effective = override ?? kpi;
            const parsed = isEmpty ? NaN : parseFloat(values[kpi.id]);
            const status = getKPIStatus(isNaN(parsed) ? null : parsed, { ...kpi, ...effective });
            const chip = statusConfig[status];
            const previous = previousValues[kpi.id];
            return (
              <TableRow key={kpi.id}>
                <TableCell className="py-2 pl-0 whitespace-normal">
                  <span className="font-semibold">{kpi.name}</span>
                  {/* Penanda netral per baris: mana yang masih kosong, tanpa hue. */}
                  {isEmpty && <span className="mt-0.5 block text-xs text-muted-foreground">belum diisi</span>}
                  {/* Di ponsel kolom Catatan disembunyikan; isiannya pindah ke bawah nama. */}
                  <Input
                    type="text"
                    placeholder="catatan…"
                    aria-label={`Catatan ${kpi.name}`}
                    className="mt-2 w-full sm:hidden"
                    value={notes[kpi.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                  />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {/* Warna identitas domain (bukan status), sebagai kunci kecil persegi. */}
                    <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: domain?.color }} />
                    {domain?.name}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{kpi.unit}</TableCell>
                <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">
                  {formatValue(effective.target, kpi.unit)}
                  {override && <span className="ml-1 text-xs text-foreground" title="Target khusus periode ini">*</span>}
                </TableCell>
                <TableCell className="num hidden text-right text-muted-foreground md:table-cell">
                  {previous !== undefined ? formatValue(previous, kpi.unit) : "-"}
                </TableCell>
                <TableCell className="align-top sm:align-middle">
                  <Input
                    type="number"
                    step="any"
                    placeholder="-"
                    aria-label={`Nilai aktual ${kpi.name}`}
                    /* .num + rata kanan supaya digit yang diketik sejajar dengan
                       kolom Target di sebelahnya. */
                    className="num w-full min-w-20 text-right"
                    value={values[kpi.id] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                  />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {status !== "no-data" && (
                    <span className={cn("inline-flex rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap", chip.bg, chip.color)}>
                      {chip.label}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden pr-0 sm:table-cell">
                  <Input
                    type="text"
                    placeholder="catatan…"
                    aria-label={`Catatan ${kpi.name}`}
                    className="w-full min-w-40"
                    value={notes[kpi.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Ujung tabel: validasi (sekunder) di kiri, satu aksi utama di kanan. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-t pt-4">
        <div className="min-w-0 flex-1">
          <DataEntryValidator
            period={initialPeriod}
            getEntries={() =>
              kpis
                .filter((kpi) => values[kpi.id] !== undefined && values[kpi.id] !== "")
                .map((kpi) => {
                  const recentValues = existingEntries
                    .filter((e) => e.kpiId === kpi.id)
                    .map((e) => e.value);
                  return {
                    kpiId: String(kpi.id),
                    kpiName: kpi.name,
                    unit: kpi.unit,
                    inputValue: parseFloat(values[kpi.id]),
                    recentValues,
                    target: kpi.target,
                    direction: kpi.direction,
                  };
                })
                .filter((e) => !isNaN(e.inputValue))
            }
          />
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 aria-hidden className="size-3.5 text-success" />
              Disimpan <span className="num">{savedAt}</span>
            </span>
          )}
          <Button type="button" onClick={handleSave} disabled={isPending}>
            <Save aria-hidden />
            {isPending ? "Menyimpan…" : "Simpan semua"}
          </Button>
        </div>
      </div>
    </div>
  );
}
