"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { unstable_rethrow } from "next/navigation";
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
      // Sukses me-redirect (dilempar ulang di bawah); yang kembali hanya error validasi.
      const result = isEdit
        ? await updateDomain(domain.id, values)
        : await createDomain(values);
      toast.error(result.error);
    } catch (err) {
      unstable_rethrow(err);
      toast.error("Gagal menyimpan domain, coba lagi");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
        <section aria-labelledby="domain-info-heading" className="space-y-5">
          <h2 id="domain-info-heading" className="text-lg font-semibold">Informasi domain</h2>

          {/* Tiap field: label, kontrol, lalu satu baris catatan yang selalu dipesan,
              supaya pesan error tidak mendorong field di bawahnya. */}
          <div className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama domain</FormLabel>
                  <FormControl><Input placeholder="Sales" {...field} /></FormControl>
                  <div className="min-h-[1lh] text-sm"><FormMessage /></div>
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
                  <div className="min-h-[1lh] text-sm"><FormMessage /></div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ICON_OPTIONS.map((o) => {
                            const Icon = domainIconMap[o.value];
                            return (
                              <SelectItem key={o.value} value={o.value}>
                                <span className="flex items-center gap-2">
                                  {Icon && <Icon aria-hidden className="size-4" />}
                                  {o.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="min-h-[1lh] text-sm"><FormMessage /></div>
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
                      <div className="flex items-center gap-2">
                        {/* Warna identitas domain dari DB/pemilih, bukan warna chrome. */}
                        <button
                          type="button"
                          className="size-9 shrink-0 rounded-md border border-input transition-colors duration-[var(--dur-micro)] hover:border-edge"
                          style={{ backgroundColor: field.value }}
                          onClick={() => {
                            const picker = document.getElementById("domain-color-picker") as HTMLInputElement;
                            picker?.click();
                          }}
                          aria-label="Klik untuk pilih warna manual"
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
                            onClick={() => field.onChange(generateSoftColor())}
                            aria-label="Generate warna baru"
                            title="Generate warna baru"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <div className="min-h-[1lh] text-sm"><FormMessage /></div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span>
                  </FormLabel>
                  <FormControl><Input placeholder="Metrik performa penjualan" {...field} /></FormControl>
                  <div className="min-h-[1lh] text-sm"><FormMessage /></div>
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex flex-wrap gap-3 border-t pt-6">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Tambah Domain"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/domain">Batal</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
