"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
    >
      🖨️ Cetak / Simpan PDF
    </button>
  );
}
