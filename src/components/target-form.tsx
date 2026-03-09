"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { upsertTarget } from "@/lib/actions/target";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KPI } from "@/lib/db/schema";

const schema = z.object({
  periodDate: z.string({ error: "Pilih periode" }).min(1),
  target: z.number({ error: "Wajib diisi" }),
  thresholdGreen: z.number({ error: "Wajib diisi" }),
  thresholdYellow: z.number({ error: "Wajib diisi" }),
});
type FormValues = z.infer<typeof schema>;

function listMonthOptions(n = 24) {
  const options: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    options.push({ label, value });
  }
  return options;
}

interface TargetFormProps {
  kpi: KPI;
  defaultPeriodDate?: string;
  defaultValues?: { target: number; thresholdGreen: number; thresholdYellow: number };
}

export function TargetForm({ kpi, defaultPeriodDate, defaultValues }: TargetFormProps) {
  const months = listMonthOptions();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      periodDate: defaultPeriodDate ?? months[0]?.value ?? "",
      target: defaultValues?.target ?? kpi.target,
      thresholdGreen: defaultValues?.thresholdGreen ?? kpi.thresholdGreen,
      thresholdYellow: defaultValues?.thresholdYellow ?? kpi.thresholdYellow,
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await upsertTarget(kpi.id, values.periodDate, {
        target: values.target,
        thresholdGreen: values.thresholdGreen,
        thresholdYellow: values.thresholdYellow,
      });
    } catch (err) {
      if (isRedirectError(err)) throw err;
      toast.error("Gagal menyimpan target, coba lagi");
    }
  }

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

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="target"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target ({kpi.unit})</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
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
                <FormLabel>Threshold Hijau</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="thresholdYellow"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold Kuning</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan Target"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/admin/kpi">Batal</a>
          </Button>
        </div>
      </form>
    </Form>
  );
}
