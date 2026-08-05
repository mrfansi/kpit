import { z } from "zod";

/**
 * Field mentah tanpa aturan lintas-field.
 *
 * Terpisah karena `.partial()` tidak bisa dipakai pada skema yang punya
 * `.refine()` — dan update parsial memang membutuhkannya. Aturan lintas-field
 * untuk jalur itu dijalankan lewat checkKPICoherence terhadap hasil GABUNGAN
 * (baris lama + perubahan), bukan hanya field yang dikirim; memeriksa maxValue
 * sendirian tanpa tahu minValue yang tersimpan tidak ada artinya.
 */
export const kpiFieldsSchema = z
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
  });

export interface KPICoherence {
  target?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
}

/** Minimum harus di bawah maksimum. Pesan galat, atau null kalau sah. */
export function checkBoundsOrder(v: KPICoherence): string | null {
  if (v.minValue != null && v.maxValue != null && v.minValue >= v.maxValue) {
    return "Nilai minimum harus lebih kecil dari maksimum";
  }
  return null;
}

/** Target di luar batas alaminya berarti target itu mustahil dicapai. */
export function checkTargetWithinBounds(v: KPICoherence): string | null {
  if (v.target == null) return null;
  if (v.minValue != null && v.target < v.minValue) {
    return "Target berada di bawah batas minimum";
  }
  if (v.maxValue != null && v.target > v.maxValue) {
    return "Target berada di atas batas maksimum";
  }
  return null;
}

export const kpiSchema = kpiFieldsSchema
  .refine((v) => checkBoundsOrder(v) === null, {
    message: "Nilai minimum harus lebih kecil dari maksimum",
    path: ["maxValue"],
  })
  .refine((v) => checkTargetWithinBounds(v) === null, {
    message: "Target berada di luar batas minimum/maksimum",
    path: ["target"],
  });

export type KPIFormValues = z.infer<typeof kpiSchema>;
