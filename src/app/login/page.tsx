import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight [font-stretch:125%]">KPI Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Portal Laporan KPI</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
