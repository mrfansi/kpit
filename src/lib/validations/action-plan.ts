import { z } from "zod";
import { ACTION_PLAN_STATUSES } from "@/lib/action-plan";

export const actionPlanSchema = z.object({
  kpiId: z.number({ error: "KPI wajib dipilih" }).int().positive("KPI wajib dipilih"),
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(120, "Judul maksimal 120 karakter"),
  description: z.string().trim().max(1000, "Deskripsi maksimal 1000 karakter").optional().or(z.literal("")),
  owner: z.string().trim().min(2, "PIC minimal 2 karakter").max(80, "PIC maksimal 80 karakter"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline harus format YYYY-MM-DD"),
  status: z.enum(ACTION_PLAN_STATUSES).default("open"),
});

export const actionPlanUpdateSchema = actionPlanSchema.omit({ kpiId: true }).partial().extend({
  status: z.enum(ACTION_PLAN_STATUSES).optional(),
});

export type ActionPlanFormValues = z.infer<typeof actionPlanSchema>;
