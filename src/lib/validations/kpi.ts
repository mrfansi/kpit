import { z } from "zod";

export const kpiSchema = z.object({
  domainId: z.number({ error: "Domain wajib dipilih" }).int().positive("Domain wajib dipilih"),
  name: z.string().min(3, "Nama minimal 3 karakter").max(100),
  description: z.string().max(255).optional().or(z.literal("")),
  unit: z.string().min(1, "Unit wajib diisi").max(20),
  target: z.number({ error: "Target wajib diisi" }),
  thresholdGreen: z.number({ error: "Threshold hijau wajib diisi" }),
  thresholdYellow: z.number({ error: "Threshold kuning wajib diisi" }),
  refreshType: z.enum(["realtime", "periodic"]),
  period: z.enum(["daily", "weekly", "monthly"]),
});

export type KPIFormValues = z.infer<typeof kpiSchema>;
