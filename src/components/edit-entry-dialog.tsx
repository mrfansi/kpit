"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { updateEntry } from "@/lib/actions/entry";
import { toast } from "sonner";

interface EditEntryDialogProps {
  id: number;
  currentValue: number;
  currentNote?: string | null;
  unit: string;
  period: string;
}

export function EditEntryDialog({ id, currentValue, currentNote, unit, period }: EditEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentValue));
  const [note, setNote] = useState(currentNote ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num)) {
      toast.error("Nilai tidak valid");
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateEntry(id, num, note);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Data berhasil diperbarui");
        setOpen(false);
      } catch {
        toast.error("Gagal menyimpan perubahan, coba lagi");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          title="Edit entry"
          aria-label={`Edit data ${period}`}
        >
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Edit data: {period}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-entry-value-${id}`}>Nilai ({unit})</Label>
            <Input
              id={`edit-entry-value-${id}`}
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-entry-note-${id}`}>
              Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Textarea
              id={`edit-entry-note-${id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
