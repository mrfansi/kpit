"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { domainSchema, type DomainFormValues } from "@/lib/validations/domain";
import { createDomain, updateDomain } from "@/lib/actions/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Domain } from "@/lib/db/schema";

const ICON_OPTIONS = [
  { value: "BarChart2", label: "📊 Bar Chart" },
  { value: "TrendingUp", label: "📈 Trending Up" },
  { value: "Users", label: "👥 Users" },
  { value: "Settings", label: "⚙️ Settings" },
];

interface DomainFormProps {
  domain?: Domain;
}

export function DomainForm({ domain }: DomainFormProps) {
  const isEdit = !!domain;

  const form = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      name: domain?.name ?? "",
      slug: domain?.slug ?? "",
      icon: domain?.icon ?? "BarChart2",
      color: domain?.color ?? "#6366f1",
      description: domain?.description ?? "",
    },
  });

  async function onSubmit(values: DomainFormValues) {
    try {
      if (isEdit) {
        await updateDomain(domain.id, values);
      } else {
        await createDomain(values);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      toast.error("Gagal menyimpan domain, coba lagi");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Domain</FormLabel>
              <FormControl><Input placeholder="Sales" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  placeholder="sales"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ICON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warna (hex)</FormLabel>
                <FormControl>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-9 w-10 rounded border cursor-pointer p-0.5"
                    />
                    <Input placeholder="#6366f1" {...field} className="flex-1" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deskripsi (opsional)</FormLabel>
              <FormControl><Input placeholder="Metrik performa penjualan" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Domain"}
          </Button>
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Batal
          </Button>
        </div>
      </form>
    </Form>
  );
}
