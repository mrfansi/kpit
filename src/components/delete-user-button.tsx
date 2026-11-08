"use client";

import { useState } from "react";
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
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/lib/actions/user-actions";
import { toast } from "sonner";

export function DeleteUserButton({ id, name, isCurrentUser }: {
  id: string;
  name: string;
  isCurrentUser: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (isCurrentUser) return null;

  async function handleDelete() {
    const result = await deleteUserAction(id);
    if (result?.error) toast.error(result.error);
    else toast.success("User dihapus.");
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label={`Hapus user ${name}`}
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus user</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus user &quot;{name}&quot;? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
