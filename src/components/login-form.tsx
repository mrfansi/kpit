"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function LoginFormInner() {
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

  // Pesan galat dikaitkan ke kedua field agar dibacakan pembaca layar.
  const errorProps = error ? { "aria-invalid": true, "aria-describedby": "login-error" } : {};

  return (
    <section aria-labelledby="login-heading" className="space-y-6">
      <div>
        <h2 id="login-heading" className="text-lg font-semibold">Masuk</h2>
        <p className="mt-1 text-sm text-muted-foreground">Login untuk mengakses halaman admin</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            {...errorProps}
          />
        </div>
        {error && <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
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
