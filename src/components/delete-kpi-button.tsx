"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteKPI } from "@/lib/actions/kpi";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteKPIButtonProps {
  id: number;
  name: string;
}

export function DeleteKPIButton({ id, name }: DeleteKPIButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteKPI(id);
        toast.success(`KPI "${name}" berhasil dihapus`);
      } catch {
        toast.error("Gagal menghapus KPI, coba lagi");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          disabled={isPending}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus KPI?</AlertDialogTitle>
          <AlertDialogDescription>
            KPI <span className="font-semibold text-foreground">&ldquo;{name}&rdquo;</span> akan dinonaktifkan
            dan tidak akan muncul di dashboard. Data historis tetap tersimpan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ya, Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
