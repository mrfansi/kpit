import { z } from "zod";

export const domainSchema = z.object({
  name: z.string({ error: "Nama wajib diisi" }).min(2, "Minimal 2 karakter"),
  slug: z
    .string({ error: "Slug wajib diisi" })
    .min(2, "Minimal 2 karakter")
    .regex(/^[a-z0-9-]+$/, "Hanya huruf kecil, angka, dan tanda hubung"),
  icon: z.string({ error: "Icon wajib diisi" }).min(1),
  color: z.string({ error: "Warna wajib diisi" }).regex(/^#[0-9a-fA-F]{6}$/, "Format hex tidak valid"),
  description: z.string().optional(),
});

export type DomainFormValues = z.infer<typeof domainSchema>;
