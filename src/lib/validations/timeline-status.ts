import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format hex #RRGGBB");

export const statusSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong").max(50),
  color: hexColor.default("#9ca3af"),
});

export type StatusFormValues = z.infer<typeof statusSchema>;
