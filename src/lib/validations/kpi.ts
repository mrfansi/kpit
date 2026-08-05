import { z } from "zod";

export const kpiSchema = z
  .object({
    domainId: z.number({ error: "Domain wajib dipilih" }).int().positive("Domain wajib dipilih"),
    name: z.string().min(3, "Nama minimal 3 karakter").max(100),
    description: z.string().max(255).optional().or(z.literal("")),
    unit: z.string().min(1, "Unit wajib diisi").max(20),
    target: z.number({ error: "Target wajib diisi" }),
    thresholdGreen: z.number({ error: "Threshold hijau wajib diisi" }),
    thresholdYellow: z.number({ error: "Threshold kuning wajib diisi" }),
    direction: z.enum(["higher_better", "lower_better"]),
    // Batas alami metrik. Kosong = tidak berbatas.
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
    refreshType: z.enum(["realtime", "periodic"]),
    period: z.enum(["daily", "weekly", "monthly"]),
  })
  .refine(
    (v) => v.minValue == null || v.maxValue == null || v.minValue < v.maxValue,
    { message: "Nilai minimum harus lebih kecil dari maksimum", path: ["maxValue"] }
  )
  .refine(
    // Target di luar batas alaminya berarti target itu mustahil dicapai.
    (v) =>
      (v.minValue == null || v.target >= v.minValue) &&
      (v.maxValue == null || v.target <= v.maxValue),
    { message: "Target berada di luar batas minimum/maksimum", path: ["target"] }
  );

export type KPIFormValues = z.infer<typeof kpiSchema>;
