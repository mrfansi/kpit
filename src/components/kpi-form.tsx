"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { kpiSchema, type KPIFormValues } from "@/lib/validations/kpi";
import { createKPI, updateKPI } from "@/lib/actions/kpi";
import type { Domain, KPI } from "@/lib/db/schema";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface KPIFormProps {
  domains: Domain[];
  defaultValues?: KPI;
}

export function KPIForm({ domains, defaultValues }: KPIFormProps) {
  const isEdit = !!defaultValues;

  const form = useForm<KPIFormValues>({
    resolver: zodResolver(kpiSchema),
    defaultValues: defaultValues
      ? {
          domainId: defaultValues.domainId,
          name: defaultValues.name,
          description: defaultValues.description ?? "",
          unit: defaultValues.unit,
          target: defaultValues.target,
          thresholdGreen: defaultValues.thresholdGreen,
          thresholdYellow: defaultValues.thresholdYellow,
          direction: defaultValues.direction ?? "higher_better",
          refreshType: defaultValues.refreshType,
          period: defaultValues.period,
        }
      : {
          name: "",
          description: "",
          unit: "%",
          target: 0,
          thresholdGreen: 0,
          thresholdYellow: 0,
          direction: "higher_better",
          refreshType: "periodic",
          period: "monthly",
        },
  });

  const [generating, setGenerating] = useState(false);

  async function handleGenerateDescription() {
    const name = form.getValues("name");
    if (!name || name.trim().length < 3) {
      toast.error("Isi nama KPI terlebih dahulu (minimal 3 karakter)");
      return;
    }

    const domainId = form.getValues("domainId");
    const domain = domains.find((d) => d.id === domainId);

    setGenerating(true);
    try {
      const res = await fetch("/api/kpi/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          unit: form.getValues("unit") || "%",
          target: form.getValues("target") || 0,
          direction: form.getValues("direction") || "higher_better",
          domain: domain?.name || "Umum",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghasilkan deskripsi");
      }

      const data = await res.json();
      form.setValue("description", data.description, { shouldDirty: true });
      toast.success("Deskripsi berhasil di-generate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setGenerating(false);
    }
  }

  async function onSubmit(values: KPIFormValues) {
    try {
      if (isEdit) {
        await updateKPI(defaultValues.id, values);
      } else {
        await createKPI(values);
      }
      // redirect di server action akan membawa ?success= ke halaman tujuan
    } catch (err: unknown) {
      if (isRedirectError(err)) throw err;
      toast.error("Terjadi kesalahan, coba lagi");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
        {/* Domain */}
        <FormField
          control={form.control}
          name="domainId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Pilih domain..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Nama */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama KPI</FormLabel>
              <FormControl><Input placeholder="Contoh: Conversion Rate" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Deskripsi */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={generating}
                  className="h-6 text-xs px-2 gap-1"
                >
                  {generating ? (
                    <>
                      <span aria-hidden="true" className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
              <FormControl><Input placeholder="Penjelasan singkat KPI ini..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* Unit & Target & Direction */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl><Input placeholder="%, Rp, unit..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="target"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target</FormLabel>
                <FormControl><Input type="number" step="any" placeholder="0" onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arah KPI</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="higher_better">↑ Makin tinggi makin baik</SelectItem>
                    <SelectItem value="lower_better">↓ Makin rendah makin baik</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Thresholds */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="thresholdGreen"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold Hijau 🟢</FormLabel>
                <FormControl><Input type="number" step="any" placeholder="Nilai on track" onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                <FormDescription className="text-xs">
                  {form.watch("direction") === "lower_better"
                    ? "Nilai ≤ ini = On Track"
                    : "Nilai ≥ ini = On Track"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="thresholdYellow"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold Kuning 🟡</FormLabel>
                <FormControl><Input type="number" step="any" placeholder="Nilai at risk" onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                <FormDescription className="text-xs">
                  {form.watch("direction") === "lower_better"
                    ? "Nilai ≤ ini (tapi > hijau) = At Risk"
                    : "Nilai ≥ ini (tapi < hijau) = At Risk"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Refresh Type & Period */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="refreshType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipe Refresh</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="periodic">Periodik</SelectItem>
                    <SelectItem value="realtime">Real-time</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="period"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Periode</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="daily">Harian</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah KPI"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/admin/kpi">Batal</a>
          </Button>
        </div>
      </form>
    </Form>
  );
}
