"use client";

import { useActionState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { deleteStatus } from "@/lib/actions/timeline-statuses";

interface DeleteStatusButtonProps {
  readonly id: number;
  readonly name: string;
}

async function handleDelete(
  _prev: { error: string | null },
  formData: FormData
) {
  const id = Number(formData.get("id"));
  try {
    await deleteStatus(id);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus status" };
  }
}

export function DeleteStatusButton({ id, name }: DeleteStatusButtonProps) {
  const [state, action, pending] = useActionState(handleDelete, {
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex items-center gap-2">
      {/* Form-nya dipertahankan (bukan diganti useTransition) supaya pesan galat
          inline dari useActionState tetap hidup — deleteStatus menolak status
          yang masih dipakai project, dan alasan itu justru yang perlu dibaca.
          AlertDialog hanya menyisipkan konfirmasi sebelum submit. */}
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={id} />
      </form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            disabled={pending}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Status?</AlertDialogTitle>
            <AlertDialogDescription>
              Status <span className="font-semibold text-foreground">&ldquo;{name}&rdquo;</span> akan
              dihapus permanen. Status yang masih dipakai project tidak bisa dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formRef.current?.requestSubmit()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <span className="text-xs text-destructive max-w-[240px]">
          {state.error}
        </span>
      )}
    </div>
  );
}
