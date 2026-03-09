# AI Narrative untuk Executive Report - Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

Ringkasan statis di executive report kurang insightful. Stakeholder butuh narasi yang menjelaskan "apa yang terjadi" dan "apa yang harus dilakukan" — bukan hanya angka.

## Solution

Tombol "Generate Analisis AI" di section Ringkasan. Klik → Gemini Flash 2.0 generate narasi → replace teks statis. Fallback ke statis jika belum di-klik atau gagal.

## Architecture

- Hybrid: "Perlu Perhatian" tetap data-driven, "Ringkasan" diganti narasi AI on-demand
- Ringkasan statis sebagai default/fallback
- Client component untuk interaksi tombol + streaming response
- API route `/api/report/narrative` untuk Gemini call

## Data Flow

1. Server render halaman (ringkasan statis tampil)
2. User klik "Generate Analisis AI"
3. Client component POST ke `/api/report/narrative` dengan KPI data JSON
4. API route susun prompt + kirim ke Gemini Flash 2.0
5. Response narasi replace teks statis
6. Gagal → error toast, statis tetap ada

## Prompt Design

Data yang dikirim:
- Daftar KPI: nama, aktual, target, status, perubahan MoM, nilai bulan lalu
- Health score + delta
- Periode

Instruksi: narasi 2-3 paragraf, Bahasa Indonesia, fokus insight actionable.

## API Route

`POST /api/report/narrative` — auth required, rate limited. Input: KPI data JSON. Output: narasi string.

## Print Support

Narasi yang sudah di-generate ikut tercetak. Belum di-generate → statis tercetak.

## Decisions

- Model: Gemini Flash 2.0 (cepat, murah)
- Trigger: on-demand via tombol
- Fallback: ringkasan statis selalu ada
- "Perlu Perhatian" tidak diganti AI
