"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Save } from "lucide-react";
import { formatValue, listLastNMonths } from "@/lib/period";
import { bulkCreateEntries } from "@/lib/actions/entry";
import type { KPI, KPIEntry, Domain } from "@/lib/db/schema";

interface BulkTableInputProps {
  kpis: KPI[];
  domains: Domain[];
  initialPeriod: string;
  existingEntries: KPIEntry[];
}

export function BulkTableInput({ kpis, domains, initialPeriod, existingEntries }: BulkTableInputProps) {
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

  // Re-sync when existingEntries prop changes (after period navigation)
  useEffect(() => {
    const newValues: Record<number, string> = {};
    const newNotes: Record<number, string> = {};
    for (const e of existingEntries) {
      newValues[e.kpiId] = String(e.value);
      if (e.note) newNotes[e.kpiId] = e.note;
    }
    setValues(newValues);
    setNotes(newNotes);
    setSavedAt(null);
  }, [initialPeriod]); // re-run when period (URL) changes

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
      const result = await bulkCreateEntries(rows);
      toast.success(`${result.saved} data berhasil disimpan`);
      setSavedAt(new Date().toLocaleTimeString("id-ID"));
    });
  }

  const filledCount = kpis.filter((k) => values[k.id] !== undefined && values[k.id] !== "").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Periode:</span>
          <Select value={initialPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {savedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              Disimpan {savedAt}
            </span>
          )}
          <Badge variant="secondary">{filledCount}/{kpis.length} diisi</Badge>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {isPending ? "Menyimpan..." : "Simpan Semua"}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="w-36">Nilai Aktual</TableHead>
              <TableHead className="w-48">Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpis.map((kpi) => {
              const domain = domainMap[kpi.domainId];
              const isFilled = values[kpi.id] !== undefined && values[kpi.id] !== "";
              return (
                <TableRow key={kpi.id} className={isFilled ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                  <TableCell className="font-medium">{kpi.name}</TableCell>
                  <TableCell>
                    <span className="text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: domain?.color }} />
                      {domain?.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{kpi.unit}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatValue(kpi.target, kpi.unit)}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      placeholder="—"
                      className="h-7 text-sm w-full"
                      value={values[kpi.id] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      placeholder="catatan..."
                      className="h-7 text-sm w-full"
                      value={notes[kpi.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

