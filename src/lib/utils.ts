import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Ukuran teks kustom dari tokens.css. Tanpa ini tailwind-merge membaca `text-readout`
// sebagai warna dan membuangnya saat digabung dengan `text-success` dan sejenisnya.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["readout", "display", "display-s", "section", "title", "lead", "md"] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
