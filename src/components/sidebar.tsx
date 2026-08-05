"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, PenLine, Globe, Upload, User, ClipboardList, Users, GanttChart, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/db/schema";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { AIChat } from "@/components/ai-chat";
import { domainIconMap } from "@/lib/domain-icons";
import { canAccessAdminRoute } from "@/lib/admin-access";

interface SidebarProps {
  domains: Domain[];
  user?: { name?: string | null; email?: string | null; role?: string | null } | null;
}

export function Sidebar({ domains, user }: SidebarProps) {
  const pathname = usePathname();
  // Middleware sudah memblokir /admin/* untuk non-admin. Tanpa gating di sini
  // pun, viewer melihat delapan tautan yang memantulkannya kembali ke "/" tanpa
  // penjelasan — jadi navigasinya yang harus jujur, bukan cuma route guard-nya.
  const isAdmin = canAccessAdminRoute(user?.role ?? undefined);

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-sidebar print:hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <BarChart2 className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">KPI Dashboard</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        <NavItem href="/" icon={Home} label="Overview" active={pathname === "/"} />
        <NavItem href="/timeline" icon={GanttChart} label="Timeline" active={pathname.startsWith("/timeline")} />

        <SectionLabel>Domain</SectionLabel>

        {domains.map((d) => {
          const Icon = domainIconMap[d.icon] ?? BarChart2;
          return (
            <NavItem
              key={d.id}
              href={`/domain/${d.slug}`}
              icon={Icon}
              label={d.name}
              active={pathname === `/domain/${d.slug}`}
              color={d.color}
            />
          );
        })}

        {/* Area admin dipisah dengan latar sendiri: sekali lihat jelas ini bukan
            navigasi baca-saja, tapi tempat data diubah. */}
        {isAdmin && (
          <div className="mt-4 rounded-lg bg-sidebar-accent/40 p-1.5 ring-1 ring-sidebar-border">
            <SectionLabel>Admin</SectionLabel>
            <div className="space-y-1">
              <NavItem href="/admin/kpi" icon={Settings} label="Kelola KPI" active={pathname.startsWith("/admin/kpi")} />
              <NavItem href="/admin/domain" icon={Globe} label="Kelola Domain" active={pathname.startsWith("/admin/domain")} />
              <NavItem href="/admin/input" icon={PenLine} label="Input Data" active={pathname === "/admin/input"} />
              <NavItem href="/admin/actions" icon={ClipboardCheck} label="Action Plan" active={pathname.startsWith("/admin/actions")} />
              <NavItem href="/admin/import" icon={Upload} label="Import CSV" active={pathname.startsWith("/admin/import")} />
              <NavItem href="/admin/users" icon={Users} label="Pengguna" active={pathname.startsWith("/admin/users")} />
              <NavItem href="/admin/timeline" icon={GanttChart} label="Kelola Timeline" active={pathname.startsWith("/admin/timeline")} />
              <NavItem href="/admin/audit" icon={ClipboardList} label="Audit Log" active={pathname.startsWith("/admin/audit")} />
            </div>
          </div>
        )}
      </nav>

      {/* Footer: theme toggle + user info */}
      <div className="shrink-0 px-3 py-3 border-t space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>
        {user && (
          <div className="space-y-1.5 pt-2 border-t">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{user.name ?? user.email}</span>
            </div>
            <AIChat />
            <Link
              href="/admin/account"
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Akun Saya
            </Link>
            <LogoutButton />
          </div>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1">
      <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {children}
      </span>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  color,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Item aktif ditandai rail kiri, bukan blok primary solid — konsisten
        // dengan rail status di kartu KPI, dan tidak berebut perhatian dengan
        // warna status yang justru harus menonjol.
        "relative flex items-center gap-2.5 rounded-md py-2 pr-2 pl-3 text-sm transition-colors",
        "before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:content-['']",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:bg-primary"
          : "text-muted-foreground before:bg-transparent hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" style={color && !active ? { color } : undefined} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
