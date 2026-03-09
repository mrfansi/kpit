"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { domainSchema, type DomainFormValues } from "@/lib/validations/domain";
import { createDomain, updateDomain } from "@/lib/actions/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Domain } from "@/lib/db/schema";
import { ICON_OPTIONS, domainIconMap } from "@/lib/domain-icons";
import { RefreshCw } from "lucide-react";
import { generateSoftColor } from "@/lib/colors";

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
      color: domain?.color ?? generateSoftColor(),
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
      if (isRedirectError(err)) throw err;
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
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ICON_OPTIONS.map((o) => {
                        const Icon = domainIconMap[o.value];
                        return (
                          <SelectItem key={o.value} value={o.value}>
                            <span className="flex items-center gap-2">
                              {Icon && <Icon className="w-4 h-4" />}
                              {o.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warna</FormLabel>
                <FormControl>
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      className="w-9 h-9 rounded-md border border-input shadow-sm shrink-0"
                      style={{ backgroundColor: field.value }}
                      onClick={() => {
                        const picker = document.getElementById("domain-color-picker") as HTMLInputElement;
                        picker?.click();
                      }}
                      title="Klik untuk pilih warna manual"
                    />
                    <input
                      id="domain-color-picker"
                      type="color"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="sr-only"
                    />
                    {!isEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => field.onChange(generateSoftColor())}
                        title="Generate warna baru"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
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
          <Button type="button" variant="outline" asChild>
            <a href="/admin/domain">Batal</a>
          </Button>
        </div>
      </form>
    </Form>
  );
}
