"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
  defaultValues?: KPI; // jika ada, mode edit
}

export function KPIForm({ domains, defaultValues }: KPIFormProps) {
  const router = useRouter();
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
          refreshType: defaultValues.refreshType,
          period: defaultValues.period,
        }
      : {
          refreshType: "periodic",
          period: "monthly",
          unit: "%",
        },
  });

  async function onSubmit(values: KPIFormValues) {
    if (isEdit) {
      await updateKPI(defaultValues.id, values);
    } else {
      await createKPI(values);
    }
    router.push("/admin/kpi");
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
              <FormLabel>Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
              <FormControl><Input placeholder="Penjelasan singkat KPI ini..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* Unit & Target */}
        <div className="grid grid-cols-2 gap-4">
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
                <FormControl><Input type="number" step="any" placeholder="0" onChange={(e) => field.onChange(e.target.valueAsNumber)} value={isNaN(field.value as number) ? "" : field.value} /></FormControl>
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
                <FormControl><Input type="number" step="any" placeholder="Nilai on track" onChange={(e) => field.onChange(e.target.valueAsNumber)} value={isNaN(field.value as number) ? "" : field.value} /></FormControl>
                <FormDescription className="text-xs">Nilai ≥ ini = On Track</FormDescription>
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
                <FormControl><Input type="number" step="any" placeholder="Nilai at risk" onChange={(e) => field.onChange(e.target.valueAsNumber)} value={isNaN(field.value as number) ? "" : field.value} /></FormControl>
                <FormDescription className="text-xs">Nilai ≥ ini (tapi &lt; hijau) = At Risk</FormDescription>
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
          <Button type="button" variant="outline" onClick={() => router.push("/admin/kpi")}>
            Batal
          </Button>
        </div>
      </form>
    </Form>
  );
}
