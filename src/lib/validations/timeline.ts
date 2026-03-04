import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format hex #RRGGBB");

export const projectSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(100),
    color: hexColor.default("#6366f1"),
    description: z.string().max(500).optional().or(z.literal("")),
    startDate: isoDate,
    endDate: isoDate,
    progress: z.coerce.number().int().min(0).max(100).default(0),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const progressLogSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  content: z.string().min(1, "Konten tidak boleh kosong").max(50000),
});
