"use client";

import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

// Label per rute admin, cocok dengan label di sidebar. Diurutkan dari yang
// paling spesifik ke paling umum karena hanya kecocokan pertama yang dipakai.
const ROUTES: { pattern: RegExp; label: string }[] = [
  { pattern: /^\/admin\/kpi\/archived/, label: "KPI Diarsipkan" },
  { pattern: /^\/admin\/kpi\/new/, label: "Tambah KPI" },
  { pattern: /^\/admin\/kpi\/[^/]+\/edit/, label: "Edit KPI" },
  { pattern: /^\/admin\/kpi\/[^/]+\/targets/, label: "Target KPI" },
  { pattern: /^\/admin\/kpi/, label: "Kelola KPI" },
  { pattern: /^\/admin\/domain\/new/, label: "Tambah Domain" },
  { pattern: /^\/admin\/domain\/[^/]+\/edit/, label: "Edit Domain" },
  { pattern: /^\/admin\/domain/, label: "Kelola Domain" },
  { pattern: /^\/admin\/input/, label: "Input Data" },
  { pattern: /^\/admin\/actions/, label: "Action Plan" },
  { pattern: /^\/admin\/import\/targets/, label: "Import Target" },
  { pattern: /^\/admin\/import/, label: "Import CSV" },
  { pattern: /^\/admin\/users/, label: "Pengguna" },
  { pattern: /^\/admin\/timeline/, label: "Kelola Timeline" },
  { pattern: /^\/admin\/audit/, label: "Audit Log" },
  { pattern: /^\/admin\/account/, label: "Akun Saya" },
];

function getLabel(pathname: string): string {
  return ROUTES.find((r) => r.pattern.test(pathname))?.label ?? "Admin";
}

/** Chrome tenang penanda area admin: breadcrumb "Admin › <halaman>". */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const label = getLabel(pathname);

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-1.5 rounded-md border bg-accent/40 px-3 py-1.5 text-xs text-muted-foreground print:hidden"
    >
      <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span className="font-medium tracking-wide text-primary uppercase">Admin</span>
      <span aria-hidden="true">/</span>
      <span className="text-foreground">{label}</span>
    </nav>
  );
}
