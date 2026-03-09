# Timeline Report Design

## Goal

Halaman report presentasi untuk management yang menampilkan ringkasan semua project timeline beserta visual Gantt chart read-only.

## Keputusan

- **Format output:** Halaman web (shareable URL) + PDF via browser `window.print()` dengan `@media print` CSS
- **Konten:** Executive summary table + visual Gantt chart
- **Interaktivitas:** Semi-interaktif (hover tooltip untuk detail project), tanpa edit/drag
- **Filter:** Tidak ada — tampilkan semua project apa adanya
- **PDF approach:** Browser native print, bukan server-side generation — zero dependency tambahan

## Arsitektur

Halaman `/timeline/report` sebagai server component. Fetch semua project, render report lengkap. Tidak perlu autentikasi (read-only, bisa di-share ke management via URL).

### Layout Report

1. **Header** — judul "Timeline Report", tanggal generate, jumlah project
2. **Executive Summary Table** — semua project: nama, progress bar, tanggal mulai/selesai, estimasi launch
3. **Gantt Chart** — visual timeline read-only dengan hover tooltip
4. **Print CSS** — sembunyikan tombol, force background colors, landscape orientation

## Komponen Baru

- `src/app/timeline/report/page.tsx` — server component, fetch data, render layout
- `src/components/report/report-header.tsx` — header dengan judul, tanggal, statistik
- `src/components/report/report-summary-table.tsx` — tabel executive summary
- `src/components/report/report-gantt.tsx` — Gantt chart read-only dengan hover tooltip
- `src/components/report/report-print-button.tsx` — client component, tombol `window.print()`

## Refactor: Shared Layout Utility

Extract layout calculation dari `gantt-chart.tsx` ke `src/lib/gantt-layout.ts`:
- `computeGanttLayout()` — dateToX, columns, intervals, totalWidth, totalHeight
- Dipakai oleh Gantt interaktif (`gantt-chart.tsx`) dan report Gantt (`report-gantt.tsx`)

## Reuse Existing Code

- `GanttLaunchMarker` — reuse langsung untuk launch markers di report
- `getEffectiveLaunchDate` dari `src/lib/launch-date.ts` — kolom estimasi launch di tabel
- `GanttGrid`, `GanttHeader`, `GanttTodayLine` — reuse di report Gantt

## Data Flow

`page.tsx` fetch project via `getTimelineProjects()` dari `src/lib/queries/timeline.ts` -> pass sebagai props ke komponen report. Semua server-rendered kecuali print button dan tooltip hover.

## Print CSS

File: `src/app/timeline/report/report-print.css`

- Sembunyikan tombol print dan navigasi
- `-webkit-print-color-adjust: exact` untuk warna project bar dan launch marker
- `@page { size: landscape }` untuk Gantt chart
- Page break: summary table halaman pertama, Gantt chart halaman baru jika tidak muat
- Font size diperbesar untuk readability
