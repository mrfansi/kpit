import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">KPI Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Portal Laporan KPI</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
