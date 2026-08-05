"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

interface Crumb {
  label: string;
  /** Ancestor yang bisa diklik. Segmen terakhir selalu tanpa href. */
  href?: string;
}

// Trail per rute admin, cocok dengan label di sidebar. Rute dua-level (mis.
// KPI, Domain, Import) menyertakan ancestor-nya sendiri agar breadcrumb ikut
// hierarkis. Diurutkan dari yang paling spesifik ke paling umum karena hanya
// kecocokan pertama yang dipakai.
const ROUTES: { pattern: RegExp; trail: Crumb[] }[] = [
  { pattern: /^\/admin\/kpi\/archived/, trail: [{ label: "Kelola KPI", href: "/admin/kpi" }, { label: "KPI Diarsipkan" }] },
  { pattern: /^\/admin\/kpi\/new/, trail: [{ label: "Kelola KPI", href: "/admin/kpi" }, { label: "Tambah KPI" }] },
  { pattern: /^\/admin\/kpi\/[^/]+\/edit/, trail: [{ label: "Kelola KPI", href: "/admin/kpi" }, { label: "Edit KPI" }] },
  { pattern: /^\/admin\/kpi\/[^/]+\/targets/, trail: [{ label: "Kelola KPI", href: "/admin/kpi" }, { label: "Target KPI" }] },
  { pattern: /^\/admin\/kpi/, trail: [{ label: "Kelola KPI" }] },
  { pattern: /^\/admin\/domain\/new/, trail: [{ label: "Kelola Domain", href: "/admin/domain" }, { label: "Tambah Domain" }] },
  { pattern: /^\/admin\/domain\/[^/]+\/edit/, trail: [{ label: "Kelola Domain", href: "/admin/domain" }, { label: "Edit Domain" }] },
  { pattern: /^\/admin\/domain/, trail: [{ label: "Kelola Domain" }] },
  { pattern: /^\/admin\/input/, trail: [{ label: "Input Data" }] },
  { pattern: /^\/admin\/actions/, trail: [{ label: "Action Plan" }] },
  { pattern: /^\/admin\/import\/targets/, trail: [{ label: "Import CSV", href: "/admin/import" }, { label: "Import Target" }] },
  { pattern: /^\/admin\/import/, trail: [{ label: "Import CSV" }] },
  { pattern: /^\/admin\/users/, trail: [{ label: "Pengguna" }] },
  { pattern: /^\/admin\/timeline/, trail: [{ label: "Kelola Timeline" }] },
  { pattern: /^\/admin\/audit/, trail: [{ label: "Audit Log" }] },
  { pattern: /^\/admin\/account/, trail: [{ label: "Akun Saya" }] },
];

function getTrail(pathname: string): Crumb[] {
  return ROUTES.find((r) => r.pattern.test(pathname))?.trail ?? [{ label: "Admin" }];
}

/** Chrome tenang penanda area admin: breadcrumb "Admin › ... › <halaman>", hierarkis dan bisa diklik. */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const trail = getTrail(pathname);

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-1.5 rounded-md border bg-accent/40 px-3 py-1.5 text-xs text-muted-foreground print:hidden"
    >
      <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span className="font-medium tracking-wide text-primary uppercase">Admin</span>
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <Fragment key={crumb.label}>
            <span aria-hidden="true">/</span>
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground" : undefined} aria-current={isLast ? "page" : undefined}>
                {crumb.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
