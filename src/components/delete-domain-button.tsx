"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDomain } from "@/lib/actions/domain";
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
import { useRouter } from "next/navigation";

interface DeleteDomainButtonProps {
  id: number;
  name: string;
}

export function DeleteDomainButton({ id, name }: DeleteDomainButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteDomain(id);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Domain "${name}" berhasil dihapus`);
        router.refresh();
      } catch {
        toast.error("Gagal menghapus domain, coba lagi");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          aria-label="Hapus domain"
          title="Hapus domain"
          disabled={isPending}
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus domain?</AlertDialogTitle>
          <AlertDialogDescription>
            Domain <span className="font-semibold text-foreground">&ldquo;{name}&rdquo;</span> dan semua
            KPI di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} variant="destructive">
            Ya, hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
