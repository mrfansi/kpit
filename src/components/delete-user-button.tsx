"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/lib/actions/user-actions";
import { toast } from "sonner";

export function DeleteUserButton({ id, name, isCurrentUser }: {
  id: string;
  name: string;
  isCurrentUser: boolean;
}) {
  if (isCurrentUser) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive hover:text-destructive"
      onClick={async () => {
        if (!confirm(`Hapus user "${name}"?`)) return;
        const result = await deleteUserAction(id);
        if (result?.error) toast.error(result.error);
        else toast.success("User dihapus.");
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
