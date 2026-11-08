/**
 * Check if HTML string contains only tags with no visible text content.
 */
export function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

/**
 * Teks polos menjadi paragraf HTML, dengan entitas di-escape.
 *
 * Dipakai untuk memuat draf AI ke dalam rich text editor. Teks model diperlakukan
 * sebagai data, bukan markup: tanpa escape, satu karakter "<" saja sudah cukup
 * membuat sisa kalimat hilang saat dirender. Server tetap menjalankan
 * sanitize-html sebelum menyimpan — ini lapisan pertama, bukan satu-satunya.
 */
export function textToHtml(text: string): string {
  const escape = (s: string) =>
    s
      // & harus lebih dulu, kalau tidak ia akan meng-escape ulang hasil
      // penggantian berikutnya menjadi &amp;lt;
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";

  return paragraphs
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
