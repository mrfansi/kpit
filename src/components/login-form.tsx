"use client";

import { useState, useSyncExternalStore, Suspense } from "react";
import { signIn } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/** Same-origin paths only (no `//host`, `/\host` or absolute URLs); evaluated on submit because it needs `location`. */
function safeCallbackUrl(raw: string | null) {
  if (!raw?.startsWith("/")) return "/";
  try {
    return new URL(raw, window.location.origin).origin === window.location.origin ? raw : "/";
  } catch {
    return "/";
  }
}

const noopSubscribe = () => () => {};

function LoginFormInner() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("callbackUrl");

  // Inputs are uncontrolled so text typed before hydration survives; submit stays disabled until hydrated so a pre-hydration submit can't be a native GET.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError("");

    const { error: signInError } = await signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.status === 429 ? "Terlalu banyak percobaan login. Coba lagi dalam 1 menit." : "Email atau password salah.");
    } else {
      // Full navigation so the root layout re-renders with the signed-in shell.
      window.location.assign(safeCallbackUrl(requested));
    }
  }

  // Pesan galat dikaitkan ke kedua field agar dibacakan pembaca layar.
  const errorProps = error ? { "aria-invalid": true, "aria-describedby": "login-error" } : {};

  return (
    <section aria-labelledby="login-heading" className="space-y-6">
      <div>
        <h2 id="login-heading" className="text-lg font-semibold">Masuk</h2>
        <p className="mt-1 text-sm text-muted-foreground">Masuk untuk mengakses dashboard KPI</p>
      </div>
      <form method="post" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="h-10"
            name="email"
            placeholder="admin@kpit.local"
            required
            autoComplete="email"
            {...errorProps}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            className="h-10"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            {...errorProps}
          />
        </div>
        {error && <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading || !hydrated}>
          {loading && <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          Masuk
        </Button>
      </form>
    </section>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
