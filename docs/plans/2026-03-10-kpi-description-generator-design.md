# AI Generate Deskripsi KPI - Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

Field deskripsi KPI sering kosong atau tidak informatif. Deskripsi yang baik penting untuk AI narrative report dan pemahaman stakeholder.

## Solution

Tombol "Generate Deskripsi" di form KPI. Klik → Gemini Flash Lite generate deskripsi berdasarkan nama + unit + target + direction + domain → isi field deskripsi. User bisa edit hasilnya.

## Architecture

- API route `POST /api/kpi/generate-description` — auth required
- Tombol di samping field deskripsi di `kpi-form.tsx`
- Gemini 3.1 Flash Lite (sama dengan narrative)
- Deskripsi max 255 karakter (sesuai schema)

## Data Flow

1. User isi nama KPI, pilih domain, unit, target, direction
2. User klik "Generate Deskripsi"
3. Client POST ke `/api/kpi/generate-description` dengan `{ name, unit, target, direction, domain }`
4. API construct prompt → Gemini → return deskripsi
5. Deskripsi mengisi field, user bisa edit sebelum submit

## Prompt Design

Input: nama KPI, unit, target, direction, domain
Instruksi: tulis 1 kalimat deskripsi dalam Bahasa Indonesia, max 200 karakter, jelaskan apa yang diukur dan mengapa penting.

## Error Handling

- Nama KPI kosong → tombol disabled
- API key missing → error "AI tidak tersedia"
- Gemini error → error message, field tetap editable manual

## Decisions

- Model: Gemini 3.1 Flash Lite (cepat, murah, konsisten dengan narrative)
- Trigger: on-demand via tombol
- Bahasa: Bahasa Indonesia
- Max output: 200 karakter (buffer 55 dari limit 255)
