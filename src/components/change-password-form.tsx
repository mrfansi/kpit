"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";

const initial: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Ganti Password
        </CardTitle>
        <CardDescription>Password baru minimal 8 karakter</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          )}
          {state.success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-2 rounded-md">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Password berhasil diubah.
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="password">Password Baru</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Min. 8 karakter"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Konfirmasi Password</Label>
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
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
