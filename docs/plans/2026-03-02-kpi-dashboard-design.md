# KPI Dashboard — Design Document

**Date:** 2026-03-02  
**Stack:** Next.js 16 + React, Tailwind CSS v4 + shadcn/ui, Drizzle ORM + SQLite  
**Target User:** Management/Eksekutif (C-level, Direktur)

---

## Problem Statement

Dibutuhkan sebuah dashboard terpusat untuk memantau Key Performance Indicators (KPI) dari berbagai domain bisnis (Sales, HR, Operasional, dll). Dashboard harus mudah dibaca oleh eksekutif, mendukung kombinasi data real-time dan periodik, tanpa memerlukan autentikasi.

---

## Approach: Static KPI Registry

KPI didefinisikan sebagai konfigurasi terstruktur di database. Dashboard membaca data secara dinamis berdasarkan registry tersebut. Setiap KPI memiliki domain, target, threshold warna, dan tipe refresh.

---

## Core Features

### 1. Overview Dashboard (Home)
- Summary Cards per domain dengan nilai aktual vs target + persentase pencapaian
- Status Indicator: hijau/kuning/merah berdasarkan threshold yang dikonfigurasi
- Period Selector: filter by bulan, kuartal, tahun
- Last Updated timestamp untuk KPI periodik

### 2. KPI Detail View
- Trend Chart historis (line/bar) menggunakan shadcn charts (Recharts)
- Target vs Actual visualization (gauge atau progress bar)
- Data Table breakdown per periode

### 3. Domain Sections
- Navigasi sidebar/tab per domain
- Setiap domain menampilkan set KPI card-nya

### 4. KPI Management (Admin Page)
- CRUD KPI: tambah/edit/hapus definisi KPI beserta target dan threshold
- Input data aktual secara manual untuk KPI periodik
- Manajemen domain/kategori

### 5. Data Input & Sync
- Manual Input Form untuk KPI periodik (bulanan/mingguan)
- REST API Endpoint (POST) untuk integrasi sistem eksternal (real-time push)

### 6. Export & Reporting
- Export ke PDF dan CSV per periode
- Print-friendly view untuk presentasi eksekutif

---

## Architecture

### App Structure

```
src/
├── app/
│   ├── page.tsx                    # Overview Dashboard
│   ├── domain/[slug]/page.tsx      # KPI per domain
│   ├── kpi/[id]/page.tsx           # KPI Detail View
│   ├── admin/
│   │   ├── kpi/page.tsx            # KPI Management CRUD
│   │   └── input/page.tsx          # Manual Data Input
│   └── api/
│       ├── kpi/route.ts            # GET/POST KPI definitions
│       └── kpi/[id]/route.ts       # Push aktual (real-time)
├── components/
│   ├── kpi-card.tsx
│   ├── trend-chart.tsx
│   ├── domain-tabs.tsx
│   └── period-selector.tsx
├── lib/
│   ├── db/schema.ts                # Drizzle schema
│   └── kpi-config.ts               # KPI registry helpers
```

### Data Flow

```
Manual Input Form ──→ Server Action ──→ SQLite (kpi_entries)
External System   ──→ POST /api/kpi/[id] ──→ SQLite
                                                ↓
Dashboard Page ←── Server Component (Drizzle query) ←──┘
```

---

## Database Schema (Drizzle ORM + SQLite)

```ts
// domains — Sales, HR, Operasional, dll
domains: {
  id: integer (PK),
  name: text,
  slug: text (unique),
  icon: text,
  color: text
}

// kpis — definisi KPI
kpis: {
  id: integer (PK),
  domain_id: integer (FK → domains),
  name: text,
  unit: text,           // %, Rp, unit, dll
  target: real,
  threshold_green: real, // >= green
  threshold_yellow: real, // >= yellow (< green)
  refresh_type: text,   // 'realtime' | 'periodic'
  period: text          // 'daily' | 'weekly' | 'monthly'
}

// kpi_entries — data aktual per periode
kpi_entries: {
  id: integer (PK),
  kpi_id: integer (FK → kpis),
  value: real,
  period_date: text,    // ISO date string (YYYY-MM-DD)
  created_at: integer   // unix timestamp
}
```

---

## UI Components (shadcn/ui)

| Komponen        | Digunakan Untuk                          |
|-----------------|------------------------------------------|
| Card            | KPI summary cards                        |
| Badge           | Status indicator (green/yellow/red)      |
| Tabs            | Domain navigation                        |
| Select          | Period selector                          |
| Chart (Recharts)| Trend line/bar chart                     |
| Table           | Data breakdown                           |
| Form + Input    | Manual data entry, KPI management CRUD   |
| Dialog          | Confirm delete, add/edit KPI             |

---

## Non-Goals (Out of Scope)

- Autentikasi dan role management
- Drag-and-drop dashboard builder
- Notifikasi / alerting otomatis
- Multi-tenant support
