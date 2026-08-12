"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { upsertTarget } from "@/lib/actions/target";
import { checkThresholdCoherence } from "@/lib/kpi-coherence";
import { listLastNMonths } from "@/lib/period";
import { ThresholdCoherenceNotice } from "@/components/threshold-coherence-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KPI } from "@/lib/db/schema";

const baseSchema = z.object({
  periodDate: z.string({ error: "Pilih periode" }).min(1, "Pilih periode"),
  target: z.number({ error: "Wajib diisi" }).finite("Wajib diisi").positive("Harus lebih besar dari 0"),
  thresholdGreen: z.number({ error: "Wajib diisi" }).finite("Wajib diisi").positive("Harus lebih besar dari 0"),
  thresholdYellow: z.number({ error: "Wajib diisi" }).finite("Wajib diisi").positive("Harus lebih besar dari 0"),
});
type FormValues = z.infer<typeof baseSchema>;

interface TargetFormProps {
  kpi: KPI;
  defaultPeriodDate?: string;
  defaultValues?: { target: number; thresholdGreen: number; thresholdYellow: number };
}

export function TargetForm({ kpi, defaultPeriodDate, defaultValues }: TargetFormProps) {
  const months = useMemo(() => listLastNMonths(24), []);
  const lowerBetter = kpi.direction === "lower_better";

  /*
   * Urutan hijau/kuning bergantung pada arah KPI, jadi resolver-nya dibangun
   * dari `kpi.direction` dan memanggil aturan yang sama persis dengan yang
   * dipakai server action. Satu aturan, dua tempat penegakan — form menolak
   * lebih dulu, server tetap menolak kalau ada yang lewat jalur lain.
   */
  const resolver = useMemo(
    () =>
      zodResolver(
        baseSchema.superRefine((values, ctx) => {
          const blocking = checkThresholdCoherence({
            direction: kpi.direction,
            target: values.target,
            thresholdGreen: values.thresholdGreen,
            thresholdYellow: values.thresholdYellow,
          }).find((issue) => issue.level === "error");

          if (blocking) {
            ctx.addIssue({ code: "custom", path: ["thresholdGreen"], message: blocking.message });
          }
        })
      ),
    [kpi.direction]
  );

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      periodDate: defaultPeriodDate ?? months[0]?.value ?? "",
      target: defaultValues?.target ?? kpi.target,
      thresholdGreen: defaultValues?.thresholdGreen ?? kpi.thresholdGreen,
      thresholdYellow: defaultValues?.thresholdYellow ?? kpi.thresholdYellow,
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const result = await upsertTarget(kpi.id, values.periodDate, {
        target: values.target,
        thresholdGreen: values.thresholdGreen,
        thresholdYellow: values.thresholdYellow,
      });

      // Server action menolak dengan pesan, bukan dengan exception — supaya
      // penolakan validasi tampil sebagai koreksi, bukan sebagai error 500.
      if (result?.error) {
        form.setError("root", { message: result.error });
        toast.error(result.error);
      }
    } catch (err) {
      if (isRedirectError(err)) throw err;
      toast.error("Gagal menyimpan target, coba lagi");
    }
  }

  const rootError = form.formState.errors.root?.message;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="periodDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Periode</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="target"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target ({kpi.unit})</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} value={numberFieldValue(field.value)} onChange={(e) => field.onChange(parseNumberInput(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="thresholdGreen"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold Hijau 🟢</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} value={numberFieldValue(field.value)} onChange={(e) => field.onChange(parseNumberInput(e.target.value))} />
                </FormControl>
                <FormDescription className="text-xs">
                  {lowerBetter ? "Nilai ≤ ini = On Track" : "Nilai ≥ ini = On Track"}
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
                <FormControl>
                  <Input type="number" step="any" {...field} value={numberFieldValue(field.value)} onChange={(e) => field.onChange(parseNumberInput(e.target.value))} />
                </FormControl>
                <FormDescription className="text-xs">
                  {lowerBetter
                    ? "Nilai ≤ ini (tapi > hijau) = At Risk"
                    : "Nilai ≥ ini (tapi < hijau) = At Risk"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <ThresholdCoherenceNotice
          direction={kpi.direction}
          target={form.watch("target")}
          thresholdGreen={form.watch("thresholdGreen")}
          thresholdYellow={form.watch("thresholdYellow")}
        />

        {rootError && (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft p-3 text-xs text-danger">
            {rootError}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan Target"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/kpi">Batal</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}

/*
 * `valueAsNumber` mengembalikan NaN untuk input kosong. Kalau NaN itu masuk ke
 * state form, React memantulkannya balik sebagai `value={NaN}` dan memicu
 * warning "Received NaN for the `value` attribute". Kosong dipetakan ke
 * `undefined` supaya Zod melaporkannya sebagai "Wajib diisi", bukan NaN.
 */
function parseNumberInput(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function numberFieldValue(value: number | undefined): number | "" {
  return value === undefined || Number.isNaN(value) ? "" : value;
}
