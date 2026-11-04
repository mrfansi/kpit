import { z } from "zod";

export const BRAND_FONTS = ["Inter", "Plus Jakarta Sans", "Poppins", "Montserrat", "Lato", "Source Sans 3", "IBM Plex Sans", "Merriweather", "Playfair Display", "DM Sans"] as const;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Gunakan warna heksadesimal enam digit.");

export const brandStyleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  mode: z.enum(["dark", "light"]),
  colors: z.object({ background: hex, backgroundEnd: hex, surface: hex, text: hex, mutedText: hex, primary: hex, accent: hex }).strict(),
  fonts: z.object({ heading: z.enum(BRAND_FONTS), body: z.enum(BRAND_FONTS) }).strict(),
  radius: z.enum(["none", "small", "medium", "large"]),
  titleCase: z.enum(["normal", "uppercase"]),
  footerText: z.string().trim().max(80),
  guideline: z.string().trim().max(600),
}).strict();
export type BrandStyle = z.infer<typeof brandStyleSchema>;

export const DEFAULT_BRAND_STYLE: BrandStyle = {
  name: "KPIT Default",
  mode: "dark",
  colors: { background: "#0f172a", backgroundEnd: "#1e293b", surface: "#222a3b", text: "#f8fafc", mutedText: "#94a3b8", primary: "#3b82f6", accent: "#22c55e" },
  fonts: { heading: "Inter", body: "Inter" },
  radius: "large",
  titleCase: "normal",
  footerText: "",
  guideline: "",
};

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastProblems(style: BrandStyle): string[] {
  const problems: string[] = [];
  for (const [foreground, foregroundLabel, minimum] of [["text", "Teks", 4.5], ["mutedText", "Teks sekunder", 3], ["primary", "Warna utama", 3]] as const) {
    for (const [background, backgroundLabel] of [["background", "latar awal"], ["backgroundEnd", "latar akhir"], ...(foreground === "primary" ? [] : [["surface", "permukaan"]] as const)] as const) {
      const first = luminance(style.colors[foreground]);
      const second = luminance(style.colors[background]);
      const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      if (ratio < minimum) problems.push(`${foregroundLabel} pada ${backgroundLabel}: kontras ${ratio.toFixed(2)}:1 (minimal ${minimum}:1)`);
    }
  }
  return problems;
}
