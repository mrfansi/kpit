"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineProjectFormDialog } from "@/components/timeline-project-form";
import type { TimelineProjectStatus } from "@/lib/db/schema";

/**
 * Sebelumnya project hanya bisa dibuat dari halaman publik /timeline, sementara
 * menghapusnya hanya bisa dari sini — CRUD-nya terpecah di dua tempat tanpa alasan.
 */
export function AddProjectButton({ statuses }: { statuses: TimelineProjectStatus[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Tambah project
      </Button>
      <TimelineProjectFormDialog open={open} onOpenChange={setOpen} statuses={statuses} />
    </>
  );
}
