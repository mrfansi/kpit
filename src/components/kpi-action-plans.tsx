"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import type { KPIActionPlan } from "@/lib/db/schema";
import { createActionPlan, deleteActionPlan, updateActionPlan } from "@/lib/actions/action-plan";
import { actionPlanStatusLabels, isActionPlanOverdue, type ActionPlanStatus } from "@/lib/action-plan";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { formatDueDate } from "@/lib/date-utils";

interface KPIActionPlansProps {
  kpiId: number;
  initialActions: KPIActionPlan[];
  suggestion?: {
    title: string;
    description: string;
  } | null;
  /**
   * Daftar rencananya tetap dibaca siapa pun — itu informasi. Yang digating
   * hanya kontrol tulisnya, karena /kpi/[id] publik (middleware hanya menjaga
   * /admin) dan server action menolak non-admin saat submit.
   */
  canEdit?: boolean;
}

const statusClass: Record<ActionPlanStatus, string> = {
  open: "bg-info-soft text-info",
  in_progress: "bg-warning-soft text-warning",
  done: "bg-success-soft text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export function KPIActionPlans({ kpiId, initialActions, suggestion, canEdit = false }: KPIActionPlansProps) {
  const [actions, setActions] = useState(initialActions);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftOwner, setDraftOwner] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function useSuggestion() {
    if (!suggestion) return;
    setDraftTitle(suggestion.title);
    setDraftDescription(suggestion.description);
  }

  function handleCreate(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const owner = String(formData.get("owner") ?? "");
    const dueDate = String(formData.get("dueDate") ?? "");
    const description = String(formData.get("description") ?? "");

    startTransition(async () => {
      try {
        const result = await createActionPlan({ kpiId, title, owner, dueDate, description, status: "open" });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        setActions((prev) => [
          {
            id: Date.now(),
            kpiId,
            title,
            owner,
            dueDate,
            description: description || null,
            status: "open",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          ...prev,
        ]);
        setDraftTitle("");
        setDraftDescription("");
        setDraftOwner("");
        setDraftDueDate("");
        toast.success("Action plan ditambahkan");
      } catch {
        toast.error("Gagal menambahkan action plan");
      }
    });
  }

  function handleStatusChange(action: KPIActionPlan, status: ActionPlanStatus) {
    startTransition(async () => {
      try {
        const result = await updateActionPlan(action.id, action.kpiId, { status });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        setActions((prev) => prev.map((item) => item.id === action.id ? { ...item, status, updatedAt: new Date() } : item));
        toast.success("Status action plan diperbarui");
      } catch {
        toast.error("Gagal memperbarui status");
      }
    });
  }

  function handleDelete(action: KPIActionPlan) {
    startTransition(async () => {
      try {
        await deleteActionPlan(action.id, action.kpiId);
        setActions((prev) => prev.filter((item) => item.id !== action.id));
        toast.success("Action plan dihapus");
      } catch {
        toast.error("Gagal menghapus action plan");
      }
    });
  }

  return (
    // Sasaran tautan "N action plan" dari tabel KPI di Overview.
    <section id="actions" className="scroll-mt-4 space-y-4">
      <h2 className="text-lg font-semibold">
        Action plan
        {actions.length > 0 && <span className="num ml-2 text-sm font-normal text-muted-foreground">({actions.length})</span>}
      </h2>

      {canEdit && (
      <form action={handleCreate} className="grid gap-4 rounded-card bg-paper-2 p-4 print:hidden">
        {suggestion && (
          <div className="flex flex-col gap-2 border-b pb-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>Early warning tersedia sebagai draft action plan.</span>
            <Button type="button" variant="outline" size="sm" onClick={useSuggestion}>
              Use as action plan
            </Button>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-[1fr_160px_150px]">
          <div className="space-y-1.5">
            <Label htmlFor="action-title">Judul</Label>
            <Input id="action-title" name="title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Contoh: Follow up gap realisasi penjualan" disabled={isPending} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="action-owner">PIC</Label>
            <Input id="action-owner" name="owner" value={draftOwner} onChange={(event) => setDraftOwner(event.target.value)} placeholder="Nama PIC" disabled={isPending} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="action-due-date">Deadline</Label>
            <Input id="action-due-date" name="dueDate" type="date" value={draftDueDate} onChange={(event) => setDraftDueDate(event.target.value)} disabled={isPending} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="action-description">Catatan</Label>
          <Textarea id="action-description" name="description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Langkah singkat atau konteks masalah…" disabled={isPending} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending}>
            <Plus aria-hidden />
            Tambah action
          </Button>
        </div>
      </form>
      )}

      {actions.length === 0 ? (
        <EmptyState compact title="Belum ada action plan untuk KPI ini." />
      ) : (
        <ul className="divide-y border-y">
          {actions.map((action) => {
            const overdue = isActionPlanOverdue(action);
            return (
              <li key={action.id} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{action.title}</h3>
                      <Badge className={statusClass[action.status]}>{actionPlanStatusLabels[action.status]}</Badge>
                      {overdue && <Badge variant="destructive">Overdue</Badge>}
                    </div>
                    {action.description && <p className="text-sm text-muted-foreground">{action.description}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>PIC: {action.owner}</span>
                      <span className="num flex items-center gap-1">
                        <CalendarClock aria-hidden className="size-3.5" />
                        {formatDueDate(action.dueDate)}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                  <div className="flex items-center gap-2 print:hidden">
                    <Select value={action.status} onValueChange={(value) => handleStatusChange(action, value as ActionPlanStatus)} disabled={isPending}>
                      <SelectTrigger size="sm" className="w-36" aria-label={`Status action plan ${action.title}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(actionPlanStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={isPending}
                          aria-label={`Hapus action plan ${action.title}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus action plan ini?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Action plan &quot;{action.title}&quot; akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(action)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Ya, hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
