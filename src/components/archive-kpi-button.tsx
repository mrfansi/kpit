"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Archive } from "lucide-react";
import { archiveKPI } from "@/lib/actions/kpi";
import { toast } from "sonner";

interface ArchiveKPIButtonProps {
  id: number;
  name: string;
}

export function ArchiveKPIButton({ id, name }: ArchiveKPIButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      await archiveKPI(id);
      toast.success(`KPI "${name}" diarsipkan`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Arsipkan KPI" disabled={isPending}>
          <Archive className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arsipkan KPI?</AlertDialogTitle>
          <AlertDialogDescription>
            KPI <strong>{name}</strong> akan disembunyikan dari dashboard. Data historis tetap tersimpan dan bisa di-restore kapan saja.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive}>Arsipkan</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
