"use client";

import { useActionState } from "react";
import { addUserAction, type AddUserState } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const initialState: AddUserState = {};

export function AddUserForm() {
  const [state, formAction, pending] = useActionState(addUserAction, initialState);

  return (
    <section aria-labelledby="add-user-heading" className="space-y-4 border-t pt-6">
      <h2 id="add-user-heading" className="text-lg font-semibold">Tambah user baru</h2>
      <form action={formAction} className="max-w-xl space-y-4">
        {state.error && (
          <div role="alert" className="flex items-center gap-2 rounded-card bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle aria-hidden className="size-4 shrink-0" />
            {state.error}
          </div>
        )}
        {state.success && (
          <div role="status" className="flex items-center gap-2 rounded-card bg-success-soft px-3 py-2 text-sm text-success">
            <CheckCircle2 aria-hidden className="size-4 shrink-0" />
            User berhasil ditambahkan.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" placeholder="John Doe" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="john@example.com" required />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Min. 8 karakter"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              /* Least privilege: admin harus sengaja memilihnya. Default lama
                 "admin" berarti sekali lupa mengganti dropdown, pengguna baru
                 langsung dapat akses penuh. */
              defaultValue="viewer"
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-2 outline-offset-[-3px] outline-transparent transition-colors duration-[var(--dur-micro)] focus-visible:outline-ring"
            >
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          Tambah user
        </Button>
      </form>
    </section>
  );
}
