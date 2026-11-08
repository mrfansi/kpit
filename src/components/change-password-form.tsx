"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";

const initial: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <section aria-labelledby="change-password-heading" className="max-w-md space-y-4">
      <div>
        <h2 id="change-password-heading" className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound aria-hidden className="size-4 text-muted-foreground" /> Ganti password
        </h2>
        <p id="password-hint" className="mt-1 text-sm text-muted-foreground">Password baru minimal 8 karakter</p>
      </div>
      <form action={formAction} className="space-y-4">
        {state.error && (
          <div role="alert" className="flex items-center gap-2 rounded-card bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle aria-hidden className="size-4 shrink-0" />
            {state.error}
          </div>
        )}
        {state.success && (
          <div role="status" className="flex items-center gap-2 rounded-card bg-success-soft px-3 py-2 text-sm text-success">
            <CheckCircle2 aria-hidden className="size-4 shrink-0" />
            Password berhasil diubah.
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Password saat ini</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password baru</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Min. 8 karakter"
            required
            minLength={8}
            aria-describedby="password-hint"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Konfirmasi password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            placeholder="Ulangi password baru"
            required
            minLength={8}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          Simpan password
        </Button>
      </form>
    </section>
  );
}
