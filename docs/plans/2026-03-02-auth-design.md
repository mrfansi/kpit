# Authentication Design — KPI Dashboard

**Date:** 2026-03-02  
**Stack:** NextAuth.js v5 (Auth.js), bcryptjs, SQLite (Drizzle ORM)

---

## Problem

Halaman admin (`/admin/*`) tidak terlindungi — siapapun bisa mengakses CRUD KPI, domain, dan input data. Perlu authentication untuk membatasi akses admin.

## Approach

NextAuth.js v5 dengan Credentials provider. User disimpan di tabel `users` pada SQLite yang sama. Password di-hash dengan bcryptjs.

## Access Model

- **Public** (tanpa login): `/`, `/domain/*`, `/kpi/*`, `/report/*`
- **Protected** (harus login): `/admin/*`
- Semua user yang bisa login memiliki akses penuh ke admin

## Database Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL
);
```

## Components

### `src/auth.ts`
Konfigurasi Auth.js — Credentials provider, validasi email+password ke DB via bcrypt compare, session callback menyimpan `id` dan `role`.

### `src/middleware.ts`
Proteksi semua route `/admin/*` — redirect ke `/login` jika session tidak valid.

### `/login` page
Form email + password. Menggunakan `signIn("credentials")` dari Auth.js. Redirect ke `/admin` setelah berhasil, tampilkan error jika gagal.

### `/admin/users` page
- Daftar semua user (email, nama, role, tanggal dibuat)
- Form tambah user baru (email, nama, password)
- Tombol hapus user (tidak bisa hapus diri sendiri)
- Form ubah password user

### Admin Layout
Tampilkan nama user yang login + tombol Logout di header admin pages.

## Seeding

Script `src/scripts/seed-admin.ts` membuat user admin awal dari environment variable:
- `SEED_ADMIN_EMAIL` (default: `admin@kpit.local`)
- `SEED_ADMIN_PASSWORD` (default: `admin123` — wajib diganti)

## Environment Variables

```env
AUTH_SECRET=<random 32+ char string>
SEED_ADMIN_EMAIL=admin@kpit.local
SEED_ADMIN_PASSWORD=changeme
```

## Data Flow

```
POST /api/auth/callback/credentials
  → auth.ts authorize()
  → query users table by email
  → bcrypt.compare(password, hash)
  → return user object → session JWT cookie

middleware.ts
  → auth() check
  → /admin/* without session → redirect /login
  → /login with session → redirect /admin
```
