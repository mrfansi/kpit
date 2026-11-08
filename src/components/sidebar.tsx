"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, PenLine, Globe, Upload, User, ClipboardList, Users, GanttChart, ClipboardCheck, ShieldCheck, FileBarChart2, Palette } from "lucide-react";
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

// Overview juga "aktif" di /report/all (report gabungan semua domain, tidak
// domain-spesifik), dan tiap domain juga aktif di scorecard-nya sendiri
// (/report/[slug]) — tanpa ini pengguna berada di halaman yang menurut
// sidebar bukan tempat mereka.
function isOverviewActive(pathname: string) {
  return pathname === "/" || pathname === "/report/all";
}
function isDomainActive(pathname: string, slug: string) {
  return pathname.startsWith(`/domain/${slug}`) || pathname.startsWith(`/report/${slug}`);
}

export function Sidebar({ domains, user }: SidebarProps) {
  const pathname = usePathname();
  // Middleware sudah memblokir /admin/* untuk non-admin. Tanpa gating di sini
  // pun, viewer melihat delapan tautan yang memantulkannya kembali ke "/" tanpa
  // penjelasan — jadi navigasinya yang harus jujur, bukan cuma route guard-nya.
  const isAdmin = canAccessAdminRoute(user?.role ?? undefined);

  return (
    // fixed, bukan sticky: kepala Gantt memakai sticky top-0 di dalam scroller-nya sendiri,
    // dan dua sticky top-0 di satu layar saling menimpa (gate 56). Ruangnya dipesan wrapper di layout.
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r bg-sidebar print:hidden">
      {/* Wordmark: keluarga yang sama, semibold. */}
      <div className="px-5 pt-5 pb-4">
        <span className="font-display text-lg leading-none font-semibold tracking-tight">
          KPI Dashboard
        </span>
      </div>

      <nav aria-label="Navigasi utama" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <NavItem href="/" icon={Home} label="Overview" active={isOverviewActive(pathname)} />
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
              active={isDomainActive(pathname, d.slug)}
              color={d.color}
            />
          );
        })}

        {/* Admin ditandai garis pemisah + ikon perisai, bukan kartu. Kartu
            membawa padding sendiri sehingga tiap item admin tidak lagi sebaris
            dengan Overview/Domain di atasnya, rail penanda halaman aktif ikut
            terdorong masuk, dan satu-satunya section yang dikotaki jadi terbaca
            seperti popover yang nyasar alih-alih bagian dari navigasi. */}
        {isAdmin && (
          <div className="mt-4 space-y-0.5 border-t pt-1">
            <SectionLabel icon={ShieldCheck}>Admin</SectionLabel>
            <NavItem href="/admin/kpi" icon={Settings} label="Kelola KPI" active={pathname.startsWith("/admin/kpi")} />
            <NavItem href="/admin/domain" icon={Globe} label="Kelola Domain" active={pathname.startsWith("/admin/domain")} />
            <NavItem href="/admin/input" icon={PenLine} label="Input Data" active={pathname === "/admin/input"} />
            <NavItem href="/admin/actions" icon={ClipboardCheck} label="Action Plan" active={pathname.startsWith("/admin/actions")} />
            <NavItem href="/admin/reports/monthly" icon={FileBarChart2} label="Laporan Bulanan" active={pathname.startsWith("/admin/reports/monthly")} />
            <NavItem href="/admin/presentation/brand" icon={Palette} label="Brand Presentasi" active={pathname.startsWith("/admin/presentation/brand")} />
            <NavItem href="/admin/import" icon={Upload} label="Import CSV" active={pathname.startsWith("/admin/import")} />
            <NavItem href="/admin/users" icon={Users} label="Pengguna" active={pathname.startsWith("/admin/users")} />
            <NavItem href="/admin/timeline" icon={GanttChart} label="Kelola Timeline" active={pathname.startsWith("/admin/timeline")} />
            <NavItem href="/admin/audit" icon={ClipboardList} label="Audit Log" active={pathname.startsWith("/admin/audit")} />
          </div>
        )}
      </nav>

      {/* Kaki sidebar: identitas, asisten, akun, tema, keluar. */}
      <div className="shrink-0 space-y-0.5 border-t px-3 py-3">
        {user && (
          <>
            <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-2">
              <User aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-semibold">{user.name ?? user.email}</span>
            </div>
            <AIChat />
            <Link
              href="/admin/account"
              aria-current={pathname === "/admin/account" ? "page" : undefined}
              className="flex h-9 items-center rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:bg-sidebar-accent hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-foreground"
            >
              Akun Saya
            </Link>
          </>
        )}
        <div className="flex h-9 items-center justify-between px-2.5">
          <span className="text-sm text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>
        {user && <LogoutButton />}
      </div>
    </aside>
  );
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pt-5 pb-1.5 text-xs text-muted-foreground">
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      <span>{children}</span>
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
        // Item aktif ditandai rail kiri bertinta + permukaan, bukan blok primary solid,
        // supaya tidak berebut perhatian dengan warna status yang justru harus menonjol.
        "relative flex h-9 items-center gap-2.5 rounded-md pr-2 pl-2.5 text-sm transition-colors duration-[var(--dur-micro)]",
        "before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:content-['']",
        active
          ? "bg-sidebar-accent font-semibold text-foreground before:bg-foreground"
          : "text-muted-foreground before:bg-transparent hover:bg-sidebar-accent hover:text-foreground"
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" style={color && !active ? { color } : undefined} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
