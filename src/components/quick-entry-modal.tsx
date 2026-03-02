"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { createEntry } from "@/lib/actions/entry";
import { toast } from "sonner";
import type { KPI } from "@/lib/db/schema";
import { listLastNMonths } from "@/lib/period";

const schema = z.object({
  kpiId: z.string().min(1, "Pilih KPI"),
  periodDate: z.string().min(1, "Pilih periode"),
  value: z.number({ error: "Masukkan nilai valid" }),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface QuickEntryModalProps {
  kpis: KPI[];
}

export function QuickEntryModal({ kpis }: QuickEntryModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const months = listLastNMonths(12);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kpiId: "",
      periodDate: months[0]?.value ?? "",
      value: undefined,
      note: "",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await createEntry({
          kpiId: Number(values.kpiId),
          periodDate: values.periodDate,
          value: values.value,
          note: values.note || undefined,
        });
        toast.success("Data berhasil disimpan");
        form.reset({ kpiId: "", periodDate: months[0]?.value ?? "", value: undefined, note: "" });
        setOpen(false);
      } catch {
        toast.error("Gagal menyimpan data");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs">
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
          Input Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Input Data KPI</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="kpiId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>KPI</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih KPI..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kpis.map((kpi) => (
                        <SelectItem key={kpi.id} value={String(kpi.id)}>
                          {kpi.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="periodDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih periode..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nilai</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Masukkan nilai..."
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan <span className="text-muted-foreground">(opsional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan tambahan..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
