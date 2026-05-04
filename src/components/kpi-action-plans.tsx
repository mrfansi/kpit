"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { KPIActionPlan } from "@/lib/db/schema";
import { createActionPlan, deleteActionPlan, updateActionPlan } from "@/lib/actions/action-plan";
import { actionPlanStatusLabels, isActionPlanOverdue, type ActionPlanStatus } from "@/lib/action-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface KPIActionPlansProps {
  kpiId: number;
  initialActions: KPIActionPlan[];
  suggestion?: {
    title: string;
    description: string;
  } | null;
}

const statusClass: Record<ActionPlanStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

export function KPIActionPlans({ kpiId, initialActions, suggestion }: KPIActionPlansProps) {
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
        await createActionPlan({ kpiId, title, owner, dueDate, description, status: "open" });
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
        await updateActionPlan(action.id, action.kpiId, { status });
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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Action Plan</h2>
          {actions.length > 0 && <span className="text-xs text-muted-foreground">({actions.length})</span>}
        </div>
      </div>

      <form action={handleCreate} className="grid gap-3 rounded-lg border bg-muted/20 p-4 print:hidden">
        {suggestion && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <span>Early warning tersedia sebagai draft action plan.</span>
            <Button type="button" variant="outline" size="sm" className="h-8 bg-background/80" onClick={useSuggestion}>
              Use as Action Plan
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
          <Textarea id="action-description" name="description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Langkah singkat atau konteks masalah..." disabled={isPending} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Action
          </Button>
        </div>
      </form>

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Belum ada action plan untuk KPI ini.</p>
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => {
            const overdue = isActionPlanOverdue(action);
            return (
              <li key={action.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{action.title}</h3>
                      <Badge className={`border-0 text-xs ${statusClass[action.status]}`}>{actionPlanStatusLabels[action.status]}</Badge>
                      {overdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                    </div>
                    {action.description && <p className="text-sm text-muted-foreground">{action.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>PIC: {action.owner}</span>
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {new Date(`${action.dueDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Select value={action.status} onValueChange={(value) => handleStatusChange(action, value as ActionPlanStatus)} disabled={isPending}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(actionPlanStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(action)} disabled={isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
