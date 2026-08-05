"use client";

import { useTransition, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listLastNMonths } from "@/lib/period";
import type { KPI, Domain } from "@/lib/db/schema";
import { createEntry, getExistingEntry } from "@/lib/actions/entry";

interface Props {
  kpis: KPI[];
  domains: Domain[];
}

export function ManualInputForm({ kpis, domains }: Props) {
  const months = listLastNMonths(12);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [kpiId, setKpiId] = useState("");
  const [periodDate, setPeriodDate] = useState("");
  const [existingHint, setExistingHint] = useState<string | null>(null);

  // Cek data existing untuk kombinasi KPI+periode yang baru dipilih, supaya
  // admin tahu sebelum submit kalau nilai lama akan ditimpa.
  function checkExisting(nextKpiId: string, nextPeriodDate: string) {
    if (!nextKpiId || !nextPeriodDate) { setExistingHint(null); return; }
    getExistingEntry(Number(nextKpiId), nextPeriodDate).then((existing) => {
      setExistingHint(existing ? `Sudah ada data: ${existing.value} — akan ditimpa` : null);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const kpiId = Number(formData.get("kpiId"));
    const value = Number(formData.get("value"));
    const periodDate = formData.get("periodDate") as string;
    const note = (formData.get("note") as string) || undefined;

    if (!kpiId || isNaN(value) || !periodDate) {
      toast.error("Lengkapi semua field yang wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        await createEntry({ kpiId, value, periodDate, note });
        toast.success("Data KPI berhasil disimpan");
        formRef.current?.reset();
        setKpiId("");
        setPeriodDate("");
        setExistingHint(null);
      } catch {
        toast.error("Gagal menyimpan data, coba lagi");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="kpiId">KPI</Label>
        <Select name="kpiId" required value={kpiId} onValueChange={(v) => { setKpiId(v); checkExisting(v, periodDate); }}>
          <SelectTrigger id="kpiId">
            <SelectValue placeholder="Pilih KPI..." />
          </SelectTrigger>
          <SelectContent>
            {domains.map((domain) => (
              <optgroup key={domain.id} label={domain.name}>
                {kpis
                  .filter((k) => k.domainId === domain.id)
                  .map((kpi) => (
                    <SelectItem key={kpi.id} value={String(kpi.id)}>
                      {kpi.name} ({kpi.unit})
                    </SelectItem>
                  ))}
              </optgroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="periodDate">Periode</Label>
        <Select name="periodDate" required value={periodDate} onValueChange={(v) => { setPeriodDate(v); checkExisting(kpiId, v); }}>
          <SelectTrigger id="periodDate">
            <SelectValue placeholder="Pilih periode..." />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="value">Nilai Aktual</Label>
        <Input id="value" name="value" type="number" step="any" placeholder="Masukkan nilai..." required />
        {existingHint && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="w-3 h-3" />
            {existingHint}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Catatan (opsional)</Label>
        <Input id="note" name="note" placeholder="Catatan tambahan..." />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Menyimpan..." : "Simpan Data"}
      </Button>
    </form>
  );
}
