"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteStatus } from "@/lib/actions/timeline-statuses";

interface DeleteStatusButtonProps {
  readonly id: number;
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

export function DeleteStatusButton({ id }: DeleteStatusButtonProps) {
  const [state, action, pending] = useActionState(handleDelete, {
    error: null,
  });

  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          type="submit"
          disabled={pending}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </form>
      {state.error && (
        <span className="text-xs text-destructive max-w-[240px]">
          {state.error}
        </span>
      )}
    </div>
  );
}
