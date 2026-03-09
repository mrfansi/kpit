# AI Features Roadmap KPIT - Design

**Date:** 2026-03-10
**Status:** Approved

## Context

Platform KPIT sudah punya 2 fitur AI (generate deskripsi KPI + executive report narrative) menggunakan Gemini 3.1 Flash Lite. Roadmap ini menambahkan 7 fitur AI baru untuk membantu eksekutif (insight cepat) dan admin (efisiensi kerja).

## Constraints

- Model: Google Gemini utama, dengan abstraction layer untuk future provider switching
- Trigger: On-demand (user klik tombol), tidak proaktif
- Bahasa: Bahasa Indonesia
- Auth: Semua endpoint memerlukan autentikasi

## Feature 1: AI Service Abstraction Layer

Foundation untuk semua fitur AI.

**Struktur:**
```
src/lib/ai/
├── ai-service.ts        # Interface + types
├── gemini-provider.ts   # Gemini implementation
├── sanitize.ts          # Input sanitization utilities
└── index.ts             # Export factory + types
```

- Interface `AIService` dengan method `generateText(prompt, options)`
- Implementation `GeminiAIService` yang wrap `@google/generative-ai`
- Factory function `getAIService()` return instance berdasarkan config
- Shared utilities: input sanitization, output cleaning (strip markdown, prefix removal)
- Refactor 2 API route existing (narrative + KPI description) ke abstraction ini

## Feature 2: AI KPI Root Cause Analysis

Tombol "Analisis AI" di halaman KPI detail (`/kpi/[id]`).

**Data ke AI:** nama KPI, deskripsi, domain, unit, direction, nilai 6-12 bulan terakhir, target vs aktual, MoM changes, KPI lain di domain (nama + tren singkat).

**Output:** 2-3 paragraf — tren utama, kemungkinan penyebab, satu rekomendasi tindakan.

**API:** `POST /api/kpi/analyze` — auth required.

**UI:** Tombol di KPI detail page, hasil di card expandable, bisa regenerate.

## Feature 3: AI Smart Target Suggestion

Tombol "Suggest Target" di form target KPI (admin panel).

**Data ke AI:** nama KPI, unit, direction, nilai aktual 6-12 bulan, target vs achievement rate historis, threshold saat ini.

**Output:** JSON structured — `suggestedTarget` (angka), `reasoning` (1-2 kalimat), `confidence` (low/medium/high).

**API:** `POST /api/kpi/suggest-target` — auth required, admin only.

**UI:** Tombol di samping field target. Suggestion card dengan angka + reasoning. User bisa "Terapkan" atau abaikan.

## Feature 4: AI Domain Health Summary

Tombol "Generate Summary" di halaman domain (`/domain/[slug]`).

**Data ke AI:** nama domain + deskripsi, semua KPI di domain (nama, aktual, target, achievement, status, tren MoM), health score domain.

**Output:** 2 paragraf — performa keseluruhan domain + KPI yang perlu perhatian + saran spesifik.

**API:** `POST /api/domain/summary` — auth required.

**UI:** Card di atas daftar KPI di domain page. Tombol generate, bisa regenerate.

## Feature 5: AI Timeline Risk Assessment

Tombol "Analisis Risiko" di timeline project.

**Data ke AI:** nama project, deskripsi, status, start/end date, estimated launch, buffer days, progress (%), progress logs terakhir (10-15 entries).

**Output:** JSON structured + narrative — `riskLevel` (low/medium/high/critical), `estimatedCompletion` (tanggal), `onTrack` (boolean), `analysis` (2 paragraf).

**API:** `POST /api/timeline/risk-analysis` — auth required.

**UI:** Tombol di panel detail project (Gantt). Badge risiko (warna) + narrative analysis.

## Feature 6: AI Data Entry Validation

Tombol "Validasi AI" di halaman data input (`/admin/data-input`).

**Data ke AI:** KPI dengan nilai baru, histori 3-6 bulan per KPI, unit dan range normal.

**Output:** JSON array of flags — `{ kpiId, kpiName, inputValue, concern, severity: "warning"|"info" }`.

**API:** `POST /api/kpi/validate-entries` — auth required, admin only.

**UI:** Tombol di bawah tabel input. Alert list dengan warning per KPI. Advisory only — user bisa abaikan dan tetap submit.

## Feature 7: AI Chat / Q&A

Floating chat button di sudut kanan bawah, tersedia di semua halaman.

**Contoh pertanyaan:** "KPI mana yang paling buruk bulan ini?", "Tren Revenue Growth 6 bulan?", "Domain mana paling sehat?", "Bandingkan Q1 vs Q2".

**Arsitektur:**
- Bukan general chatbot — hanya jawab tentang data platform
- API terima pertanyaan → analisis intent → query database data relevan → construct prompt → Gemini generate jawaban
- Conversation history di client-side state (bukan persistent DB)
- Limit 20 messages per session

**Data flow:**
1. User ketik pertanyaan
2. API analisis intent (KPI specific? domain? period? comparison?)
3. Query database sesuai intent
4. Construct prompt: system context + data + pertanyaan
5. Gemini generate jawaban
6. Return jawaban + data source references

**API:** `POST /api/ai/chat` — auth required.

**UI:** Floating button, panel slide-up dengan conversation interface. Label "Berdasarkan data per [tanggal]" per jawaban. Tombol reset percakapan.

## Implementation Order

1. AI Service Abstraction Layer (foundation)
2. AI Domain Health Summary (mirip narrative existing, paling mudah)
3. AI KPI Root Cause Analysis (high value, medium complexity)
4. AI Smart Target Suggestion (structured output, medium complexity)
5. AI Data Entry Validation (structured output, medium complexity)
6. AI Timeline Risk Assessment (structured + narrative, medium complexity)
7. AI Chat / Q&A (paling kompleks, terakhir)

## Decisions

- Semua fitur on-demand via tombol, tidak otomatis
- Gemini 3.1 Flash Lite untuk semua fitur (konsisten, murah, cepat)
- Abstraction layer dulu supaya tidak duplicate code
- Chat Q&A terakhir karena paling kompleks (intent detection + dynamic DB queries)
- Conversation history tidak persistent — session-based saja
