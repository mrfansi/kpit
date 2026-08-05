"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/lib/actions/timeline";
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

interface DeleteProjectButtonProps {
  id: number;
  name: string;
}

/**
 * deleteProject dipanggil dari dua tempat. Di dialog edit project ia sudah
 * dibungkus konfirmasi; di tabel Kelola Timeline dulu berupa <form> polos yang
 * menghapus seketika. Aksi yang sama tidak boleh kadang bertanya kadang tidak —
 * apalagi ikon trash-nya berada di kolom paling kanan sebuah tabel yang di-scroll.
 */
export function DeleteProjectButton({ id, name }: DeleteProjectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteProject(id);
        toast.success(`Project "${name}" berhasil dihapus`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal menghapus project, coba lagi"
        );
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
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Project?</AlertDialogTitle>
          <AlertDialogDescription>
            Project <span className="font-semibold text-foreground">&ldquo;{name}&rdquo;</span> beserta
            seluruh progress log-nya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
