# Executive Report Period Comparison - Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

Executive report (`/report/all`) hanya menampilkan satu periode pada satu waktu. Tidak ada cara untuk melihat growth metrics atau membandingkan performa antar periode.

## Solution

Menambahkan period comparison di dua level: overview (global) dan per-KPI row.

## Overview Section (Global Level)

Setelah health score saat ini, tambahkan comparison card:

1. **Health Score Delta** — "78% (+6pp vs Jan)" dengan warna hijau/merah
2. **Status Movement** — "5 KPI improved, 2 declined, 8 stable"
3. **Avg Achievement Delta** — "Rata-rata achievement 85% (+3.2pp vs Jan)"

Comparison baseline: periode sebelumnya (MoM). YoY sebagai secondary info.

## Per-KPI Row Enhancement

Kolom tambahan di setiap baris KPI:

| Kolom | Isi |
|-------|-----|
| MoM Delta | Nilai delta + arrow + warna (hijau jika "good direction") |
| YoY Delta | Sama format, vs bulan yang sama tahun lalu |
| Sparkline | Mini chart 12 bulan terakhir (SVG inline, ~80x24px) |

## Data Layer Changes

- Extend `getKPIsWithLatestEntry()` untuk return 12 sparkline entries (saat ini 6)
- Batch query untuk previous month & previous year entries (reuse pola `getPeriodComparisonEntries`)
- Hitung health score periode sebelumnya server-side untuk overview comparison

## Print Support

- Sparkline SVG muncul di print (no JS needed)
- Delta arrows pakai Unicode characters (print-friendly)
- Warna dipertahankan via `print-color-adjust: exact` yang sudah ada

## Decisions

- Sparkline: 12 bulan (pola musiman)
- Comparison: MoM + YoY
- Level: Overview + Per-KPI row
- Overview metrics: Health score delta + status movement + avg achievement delta
