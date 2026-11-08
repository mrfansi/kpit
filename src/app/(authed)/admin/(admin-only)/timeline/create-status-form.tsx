"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStatus } from "@/lib/actions/timeline-statuses";

export function CreateStatusForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await createStatus(formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        formRef.current?.reset();
        toast.success("Status ditambahkan");
      } catch {
        toast.error("Gagal menambah status, coba lagi");
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1 space-y-2">
        <Label htmlFor="name">Nama</Label>
        <Input id="name" name="name" placeholder="Contoh: On Track" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Warna</Label>
        <Input
          id="color"
          name="color"
          type="color"
          defaultValue="#6366f1"
          className="w-16 cursor-pointer p-1"
        />
      </div>
      {/* Outline: primary layar ini adalah Tambah project di kepala. */}
      <Button type="submit" variant="outline" disabled={pending}>
        Tambah
      </Button>
    </form>
  );
}
