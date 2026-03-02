# Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tambah authentication ke KPI Dashboard — proteksi `/admin/*` dengan NextAuth.js v5 Credentials provider, user management UI, dan seed admin awal.

**Architecture:** NextAuth.js v5 dengan Credentials provider. User disimpan di tabel `users` SQLite (Drizzle ORM). Middleware.ts memproteksi semua route `/admin/*` dan redirect ke `/login` jika belum auth.

**Tech Stack:** next-auth@5 (beta), bcryptjs, @types/bcryptjs, Drizzle ORM (SQLite), Zod, shadcn/ui

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install packages**

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: Verifikasi install**

```bash
node -e "require('bcryptjs'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add next-auth@beta and bcryptjs"
```

---

## Task 2: Tambah Tabel `users` ke Schema Drizzle

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0004_users_table.sql`

**Step 1: Tambah tabel users ke schema**

Di `src/lib/db/schema.ts`, tambahkan di bawah export terakhir:

```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("admin"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**Step 2: Buat migration SQL manual**

Buat file `drizzle/0004_users_table.sql`:

```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text NOT NULL DEFAULT 'admin',
  `created_at` integer NOT NULL
);
```

**Step 3: Jalankan migration**

```bash
sqlite3 kpit.db < drizzle/0004_users_table.sql
```

Verifikasi:
```bash
sqlite3 kpit.db ".schema users"
```
Expected: output CREATE TABLE users...

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0004_users_table.sql
git commit -m "feat: add users table schema and migration"
```

---

## Task 3: Buat Konfigurasi Auth.js (`src/auth.ts`)

**Files:**
- Create: `src/auth.ts`
- Create: `src/lib/db/users.ts` — query helpers untuk users table

**Step 1: Buat query helpers**

Buat `src/lib/db/users.ts`:

```typescript
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export async function getAllUsers() {
  return db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).all();
}

export async function createUser(data: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: "admin" | "viewer";
}) {
  return db.insert(users).values({
    ...data,
    role: data.role ?? "admin",
    createdAt: new Date(),
  }).run();
}

export async function deleteUser(id: string) {
  return db.delete(users).where(eq(users.id, id)).run();
}

export async function updateUserPassword(id: string, passwordHash: string) {
  return db.update(users).set({ passwordHash }).where(eq(users.id, id)).run();
}
```

**Step 2: Buat `src/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/db/users";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
```

**Step 3: Tambah AUTH_SECRET ke `.env.local`**

```bash
# Generate secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Buat `.env.local`:
```
AUTH_SECRET=<hasil generate di atas>
SEED_ADMIN_EMAIL=admin@kpit.local
SEED_ADMIN_PASSWORD=changeme123
```

**Step 4: Buat `.env.example`**

Buat `.env.example`:
```
AUTH_SECRET=your-random-secret-here
SEED_ADMIN_EMAIL=admin@kpit.local
SEED_ADMIN_PASSWORD=changeme123
```

**Step 5: Tambah `.env.local` ke `.gitignore`**

Pastikan `.env.local` ada di `.gitignore`:
```bash
echo ".env.local" >> .gitignore
```

**Step 6: Tambah route handler Auth.js**

Buat `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Step 7: Commit**

```bash
git add src/auth.ts src/lib/db/users.ts src/app/api/auth/[...nextauth]/route.ts .env.example .gitignore
git commit -m "feat: setup NextAuth.js credentials provider"
```

---

## Task 4: Buat Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Buat middleware**

Buat `src/middleware.ts`:

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthenticated = !!req.auth;

  if (isAdminRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin/kpi", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware to protect /admin routes"
```

---

## Task 5: Halaman Login (`/login`)

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/login-form.tsx`

**Step 1: Buat `src/components/login-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin/kpi";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email atau password salah.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Login untuk mengakses halaman admin</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@kpit.local"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Masuk
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Buat `src/app/login/page.tsx`**

```typescript
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">KPI Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Portal Laporan KPI</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/login/page.tsx src/components/login-form.tsx
git commit -m "feat: add login page with credentials form"
```

---

## Task 6: Seed Admin User

**Files:**
- Create: `src/scripts/seed-admin.ts`
- Modify: `package.json` — tambah script `seed:admin`

**Step 1: Buat `src/scripts/seed-admin.ts`**

```typescript
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const db = new Database("./kpit.db");

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@kpit.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existing) {
  console.log(`User ${email} sudah ada, skip.`);
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 12);
const id = randomUUID();

db.prepare(
  "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
).run(id, email, "Administrator", hash, "admin", Date.now());

console.log(`✅ Admin user dibuat: ${email}`);
db.close();
```

**Step 2: Tambah script ke `package.json`**

Tambahkan di bagian `scripts`:
```json
"seed:admin": "npx tsx src/scripts/seed-admin.ts"
```

**Step 3: Jalankan seed**

```bash
npm run seed:admin
```
Expected: `✅ Admin user dibuat: admin@kpit.local`

**Step 4: Commit**

```bash
git add src/scripts/seed-admin.ts package.json
git commit -m "feat: add seed-admin script for initial user creation"
```

---

## Task 7: Halaman `/admin/users` — User Management

**Files:**
- Create: `src/app/admin/users/page.tsx`
- Create: `src/lib/actions/user-actions.ts`
- Create: `src/components/delete-user-button.tsx`
- Create: `src/components/add-user-form.tsx`

**Step 1: Buat server actions `src/lib/actions/user-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createUser, deleteUser, updateUserPassword } from "@/lib/db/users";
import { z } from "zod";
import { auth } from "@/auth";

const AddUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "viewer"]),
});

const ChangePasswordSchema = z.object({
  userId: z.string(),
  password: z.string().min(8),
});

export async function addUserAction(formData: FormData) {
  const parsed = AddUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Data tidak valid." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await createUser({ id: randomUUID(), ...parsed.data, passwordHash });
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { error: "Email sudah digunakan." };
  }
}

export async function deleteUserAction(id: string) {
  const session = await auth();
  if (session?.user?.id === id) return { error: "Tidak bisa menghapus akun sendiri." };
  await deleteUser(id);
  revalidatePath("/admin/users");
}

export async function changePasswordAction(formData: FormData) {
  const parsed = ChangePasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Password minimal 8 karakter." };

  const hash = await bcrypt.hash(parsed.data.password, 12);
  await updateUserPassword(parsed.data.userId, hash);
  revalidatePath("/admin/users");
  return { success: true };
}
```

**Step 2: Buat `src/components/delete-user-button.tsx`**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/lib/actions/user-actions";
import { toast } from "sonner";

export function DeleteUserButton({ id, name, isCurrentUser }: { id: string; name: string; isCurrentUser: boolean }) {
  if (isCurrentUser) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive hover:text-destructive"
      onClick={async () => {
        if (!confirm(`Hapus user "${name}"?`)) return;
        const result = await deleteUserAction(id);
        if (result?.error) toast.error(result.error);
        else toast.success("User dihapus.");
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
```

**Step 3: Buat `src/app/admin/users/page.tsx`**

```typescript
import { getAllUsers } from "@/lib/db/users";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteUserButton } from "@/components/delete-user-button";
import { addUserAction } from "@/lib/actions/user-actions";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  const [users, session] = await Promise.all([getAllUsers(), auth()]);
  const currentUserId = session?.user?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" /> Manajemen User
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{users.length} user terdaftar</p>
      </div>

      {/* Daftar User */}
      <Card>
        <CardHeader><CardTitle className="text-base">Daftar User</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: idLocale })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteUserButton id={u.id} name={u.name} isCurrentUser={u.id === currentUserId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Tambah User */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tambah User Baru</CardTitle></CardHeader>
        <CardContent>
          <form action={addUserAction} className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="john@example.com" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="Min. 8 karakter" required minLength={8} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <select name="role" defaultValue="admin" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <Button type="submit">Tambah User</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/admin/users/page.tsx src/lib/actions/user-actions.ts src/components/delete-user-button.tsx
git commit -m "feat: add user management page with add/delete actions"
```

---

## Task 8: Tampilkan User Info + Logout di Sidebar

**Files:**
- Modify: `src/components/sidebar.tsx`
- Create: `src/components/logout-button.tsx`

**Step 1: Buat `src/components/logout-button.tsx`**

```typescript
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground hover:text-foreground"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="w-4 h-4 mr-2" />
      Keluar
    </Button>
  );
}
```

**Step 2: Update sidebar — tambah user info + logout di bagian bawah**

Di `src/components/sidebar.tsx`, tambahkan import `auth` dan `LogoutButton`, lalu di bagian akhir sidebar (sebelum `</nav>` atau `</aside>`) tambahkan:

```typescript
// Di bagian atas file, tambahkan:
import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import { User } from "lucide-react";

// Ubah component menjadi async server component:
export async function Sidebar({ domains }: { domains: Domain[] }) {
  const session = await auth();
  // ... existing code ...
  
  // Di bagian bawah sidebar, sebelum closing tag:
  {session?.user && (
    <div className="border-t pt-3 mt-3 space-y-1">
      <div className="flex items-center gap-2 px-2 py-1">
        <User className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{session.user.name}</span>
      </div>
      <LogoutButton />
    </div>
  )}
```

Juga tambahkan link "Users" ke menu admin di sidebar:
```typescript
<Link href="/admin/users">Users</Link>
```

**Step 3: Commit**

```bash
git add src/components/sidebar.tsx src/components/logout-button.tsx
git commit -m "feat: show user info and logout button in sidebar"
```

---

## Task 9: Build & Verifikasi

**Step 1: Build**

```bash
npm run build
```
Expected: exit code 0, semua routes terdaftar

**Step 2: Test flow login**

```bash
npm run dev
```

- Buka `http://localhost:3000/admin/kpi` tanpa login → harus redirect ke `/login`
- Login dengan `admin@kpit.local` / `changeme123` → harus redirect ke `/admin/kpi`
- Buka `/admin/users` → harus tampil daftar user
- Klik Keluar → harus redirect ke `/login`
- Buka `/` tanpa login → harus bisa akses (public)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete authentication with NextAuth.js v5

- Add users table (Drizzle + SQLite)
- NextAuth.js v5 Credentials provider
- Middleware protects /admin/* routes
- Login page at /login
- User management page at /admin/users
- Logout button in sidebar
- Seed script for initial admin user

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
