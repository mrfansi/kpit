"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { unstable_rethrow } from "next/navigation";
import { kpiSchema, type KPIFormValues } from "@/lib/validations/kpi";
import { ThresholdCoherenceNotice } from "@/components/threshold-coherence-notice";
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
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/** Satu baris catatan di bawah tiap field, selalu dipesan, supaya error tidak menggeser tata letak. */
const NOTE = "min-h-[1lh] space-y-1 text-sm";
const SECTION_HEAD = "text-lg font-semibold";

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
          minValue: defaultValues.minValue,
          maxValue: defaultValues.maxValue,
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
          minValue: null,
          maxValue: null,
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
      // Sukses me-redirect (dilempar ulang di bawah); yang kembali hanya error validasi.
      const result = isEdit
        ? await updateKPI(defaultValues.id, values)
        : await createKPI(values);
      toast.error(result.error);
    } catch (err: unknown) {
      unstable_rethrow(err);
      toast.error("Terjadi kesalahan, coba lagi");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
        <section aria-labelledby="kpi-info-heading" className="space-y-5">
          <h2 id="kpi-info-heading" className={SECTION_HEAD}>Informasi KPI</h2>
          <div className="space-y-3">
            {/* Domain */}
            <FormField
              control={form.control}
              name="domainId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih domain…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className={NOTE}><FormMessage /></div>
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
                  <div className={NOTE}><FormMessage /></div>
                </FormItem>
              )}
            />

            {/* Deskripsi */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3">
                    <FormLabel>Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span></FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleGenerateDescription}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <LoadingSpinner />
                          Generating…
                        </>
                      ) : (
                        "Generate"
                      )}
                    </Button>
                  </div>
                  <FormControl><Input placeholder="Penjelasan singkat KPI ini…" {...field} /></FormControl>
                  <div className={NOTE}><FormMessage /></div>
                </FormItem>
              )}
            />
          </div>
        </section>

        <section aria-labelledby="kpi-target-heading" className="space-y-5">
          <h2 id="kpi-target-heading" className={SECTION_HEAD}>Target dan threshold</h2>
          <div className="space-y-3">
            {/* Unit & Target & Direction */}
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl><Input placeholder="%, Rp, unit…" {...field} /></FormControl>
                    <div className={NOTE}><FormMessage /></div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target</FormLabel>
                    <FormControl><Input type="number" step="any" placeholder="0" className="num" onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                    <div className={NOTE}><FormMessage /></div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Arah KPI</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="higher_better"><ArrowUp aria-hidden className="size-3.5" />Makin tinggi makin baik</SelectItem>
                        <SelectItem value="lower_better"><ArrowDown aria-hidden className="size-3.5" />Makin rendah makin baik</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className={NOTE}><FormMessage /></div>
                  </FormItem>
                )}
              />
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="thresholdGreen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Threshold hijau</FormLabel>
                    <FormControl><Input type="number" step="any" placeholder="Nilai on track" className="num" onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                    <div className={NOTE}>
                      <FormDescription>
                        {form.watch("direction") === "lower_better"
                          ? "Nilai ≤ ini = On Track"
                          : "Nilai ≥ ini = On Track"}
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thresholdYellow"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Threshold kuning</FormLabel>
                    <FormControl><Input type="number" step="any" placeholder="Nilai at risk" className="num" onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                    <div className={NOTE}>
                      <FormDescription>
                        {form.watch("direction") === "lower_better"
                          ? "Nilai ≤ ini (tapi > hijau) = At Risk"
                          : "Nilai ≥ ini (tapi < hijau) = At Risk"}
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <ThresholdCoherenceNotice
              direction={form.watch("direction")}
              target={form.watch("target")}
              thresholdGreen={form.watch("thresholdGreen")}
              thresholdYellow={form.watch("thresholdYellow")}
            />
          </div>
        </section>

        {/* Batas alami metrik — beda dari target. Kosongkan kalau metriknya
            memang tidak berbatas; menebak batas yang tidak ada lebih buruk
            daripada tidak punya batas sama sekali. */}
        <section aria-labelledby="kpi-bounds-heading" className="space-y-5">
          <h2 id="kpi-bounds-heading" className={SECTION_HEAD}>Batas nilai</h2>
          <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="minValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nilai minimum <span className="font-normal text-muted-foreground">(opsional)</span></FormLabel>
                  <FormControl><Input type="number" step="any" placeholder="Kosongkan jika tidak terbatas" className="num" onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                  <div className={NOTE}>
                    <FormDescription>
                      Batas bawah yang mungkin secara alami, mis. 0 untuk jumlah.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nilai maksimum <span className="font-normal text-muted-foreground">(opsional)</span></FormLabel>
                  <FormControl><Input type="number" step="any" placeholder="Kosongkan jika tidak terbatas" className="num" onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)} value={typeof field.value === "number" && !isNaN(field.value) ? field.value : ""} /></FormControl>
                  <div className={NOTE}>
                    <FormDescription>
                      Mis. 100 untuk skor, 5 untuk rating. Menjaga forecast tidak
                      menembus langit-langit dan menangkap salah ketik saat input.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </div>
        </section>

        <section aria-labelledby="kpi-period-heading" className="space-y-5">
          <h2 id="kpi-period-heading" className={SECTION_HEAD}>Refresh dan periode</h2>
          <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="refreshType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe refresh</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="periodic">Periodik</SelectItem>
                      <SelectItem value="realtime">Real-time</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className={NOTE}><FormMessage /></div>
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
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Harian</SelectItem>
                      <SelectItem value="weekly">Mingguan</SelectItem>
                      <SelectItem value="monthly">Bulanan</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className={NOTE}><FormMessage /></div>
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 border-t pt-6">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Tambah KPI"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/kpi">Batal</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
