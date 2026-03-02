"use client";

import { getAllDomains, getAllKPIs } from "@/lib/queries";
import { createEntry } from "@/lib/actions/entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listLastNMonths } from "@/lib/period";
import { useActionState } from "react";
import type { KPI, Domain } from "@/lib/db/schema";

interface Props {
  kpis: KPI[];
  domains: Domain[];
}

export function ManualInputForm({ kpis, domains }: Props) {
  const months = listLastNMonths(12);
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  async function handleSubmit(prev: unknown, formData: FormData) {
    const kpiId = Number(formData.get("kpiId"));
    const value = Number(formData.get("value"));
    const periodDate = formData.get("periodDate") as string;
    const note = formData.get("note") as string | undefined;
    await createEntry({ kpiId, value, periodDate, note });
    return { success: true };
  }

  const [state, action] = useActionState(handleSubmit, null);

  return (
    <form action={action} className="space-y-4 max-w-md">
      {state && <p className="text-sm text-green-600 font-medium">✅ Data berhasil disimpan</p>}

      <div className="space-y-1.5">
        <Label htmlFor="kpiId">KPI</Label>
        <Select name="kpiId" required>
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
        <Select name="periodDate" required>
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Catatan (opsional)</Label>
        <Input id="note" name="note" placeholder="Catatan tambahan..." />
      </div>

      <Button type="submit" className="w-full">Simpan Data</Button>
    </form>
  );
}
