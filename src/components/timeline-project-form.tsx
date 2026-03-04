"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject, updateProject, deleteProject, fetchProjectLogs } from "@/lib/actions/timeline";
import { format, addMonths } from "date-fns";
import type { TimelineProject, TimelineProjectLog } from "@/lib/db/schema";
import { Trash2, ClipboardList, RefreshCw } from "lucide-react";
import { TimelineProgressLog } from "@/components/timeline-progress-log";
import { generateSoftColor } from "@/lib/colors";

interface TimelineProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: TimelineProject | null;
}

export function TimelineProjectFormDialog({
  open,
  onOpenChange,
  project,
}: TimelineProjectFormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = !!project;
  const today = format(new Date(), "yyyy-MM-dd");
  const threeMonthsLater = format(addMonths(new Date(), 3), "yyyy-MM-dd");

  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logs, setLogs] = useState<TimelineProjectLog[]>([]);
  const autoColor = useMemo(() => generateSoftColor(), []);
  const [selectedColor, setSelectedColor] = useState(project?.color ?? autoColor);

  // Sync color when project changes
  useEffect(() => {
    setSelectedColor(project?.color ?? generateSoftColor());
  }, [project?.id]);

  // Fetch logs when opening log dialog
  useEffect(() => {
    if (logDialogOpen && project) {
      fetchProjectLogs(project.id).then(setLogs);
    }
  }, [logDialogOpen, project]);

  async function handleSubmit(formData: FormData) {
    if (isEdit) {
      await updateProject(project!.id, formData);
    } else {
      await createProject(formData);
    }
    formRef.current?.reset();
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`Hapus project "${project.name}"?`)) return;
    await deleteProject(project.id);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent key={project?.id ?? "new"} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Project" : "Tambah Project"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Ubah detail project timeline."
                : "Buat project baru di timeline."}
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Project</Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={100}
                placeholder="Nama project"
                defaultValue={project?.name ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Mulai</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={project?.startDate ?? today}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Selesai</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={project?.endDate ?? threeMonthsLater}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Warna</Label>
                <input type="hidden" name="color" value={selectedColor} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-md border border-input shadow-sm shrink-0"
                    style={{ backgroundColor: selectedColor }}
                    onClick={() => {
                      const picker = document.getElementById("color-picker-hidden") as HTMLInputElement;
                      picker?.click();
                    }}
                    title="Klik untuk pilih warna manual"
                  />
                  <input
                    id="color-picker-hidden"
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="sr-only"
                  />
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setSelectedColor(generateSoftColor())}
                      title="Generate warna baru"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress">Progress (%)</Label>
                <Input
                  id="progress"
                  name="progress"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={project?.progress ?? 0}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                name="description"
                maxLength={500}
                placeholder="Deskripsi project (opsional)"
                rows={2}
                defaultValue={project?.description ?? ""}
              />
            </div>
            <div className="flex justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Hapus
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLogDialogOpen(true)}
                  >
                    <ClipboardList className="w-3.5 h-3.5 mr-1" />
                    Progress Log
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Batal
                </Button>
                <Button type="submit">{isEdit ? "Simpan" : "Tambah"}</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Separate Progress Log Dialog */}
      {isEdit && project && (
        <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Progress Log</DialogTitle>
              <DialogDescription>{project.name}</DialogDescription>
            </DialogHeader>
            <TimelineProgressLog
              projectId={project.id}
              currentProgress={project.progress}
              initialLogs={logs}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
