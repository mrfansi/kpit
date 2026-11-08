"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, Users, User, PenLine, Menu, Globe, Upload, LogIn, ClipboardList, ClipboardCheck, GanttChart, ShieldCheck, FileBarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { AIChat } from "@/components/ai-chat";
import { domainIconMap } from "@/lib/domain-icons";
import { canAccessAdminRoute } from "@/lib/admin-access";

interface MobileHeaderProps {
  domains: Domain[];
  isAuthenticated?: boolean;
  userName?: string | null;
  role?: string | null;
}

// Sama dengan sidebar desktop: Overview juga aktif di /report/all, item
// domain juga aktif di scorecard-nya sendiri (/report/[slug]), Timeline dkk.
// aktif untuk semua sub-rute-nya.
function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/report/all";
  if (href.startsWith("/domain/")) {
    return pathname.startsWith(href) || pathname.startsWith(`/report/${href.slice("/domain/".length)}`);
  }
  return pathname.startsWith(href);
}

export function MobileHeader({ domains, isAuthenticated = false, userName, role }: MobileHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Login saja tidak cukup untuk melihat menu admin — lihat Sidebar.
  const isAdmin = canAccessAdminRoute(role ?? undefined);

  const navItems: { href: string; icon: React.ElementType; label: string; color?: string }[] = [
    { href: "/", icon: Home, label: "Overview" },
    { href: "/timeline", icon: GanttChart, label: "Timeline" },
    ...domains.map((d) => ({
      href: `/domain/${d.slug}`,
      icon: domainIconMap[d.icon] ?? BarChart2,
      label: d.name,
      color: d.color,
    })),
  ];

  const adminItems = [
    { href: "/admin/kpi", icon: Settings, label: "Kelola KPI" },
    { href: "/admin/domain", icon: Globe, label: "Kelola Domain" },
    { href: "/admin/input", icon: PenLine, label: "Input Data" },
    { href: "/admin/actions", icon: ClipboardCheck, label: "Action Plan" },
    { href: "/admin/reports/monthly", icon: FileBarChart2, label: "Laporan Bulanan" },
    { href: "/admin/import", icon: Upload, label: "Import CSV" },
    { href: "/admin/users", icon: Users, label: "Pengguna" },
    { href: "/admin/timeline", icon: GanttChart, label: "Kelola Timeline" },
    { href: "/admin/audit", icon: ClipboardList, label: "Audit Log" },
  ];

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 lg:static lg:hidden print:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Buka menu">
            <Menu aria-hidden className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0 sm:max-w-xs" showCloseButton={false}>
          <SheetHeader className="shrink-0 px-5 pt-5 pb-4">
            <SheetTitle className="font-display text-lg leading-none font-semibold tracking-tight">
              KPI Dashboard
            </SheetTitle>
          </SheetHeader>

          <nav aria-label="Navigasi utama" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
            {navItems.map(({ href, icon: Icon, label, color }) => (
              <MobileNavItem
                key={href}
                href={href}
                icon={Icon}
                label={label}
                color={color}
                active={isNavActive(pathname, href)}
                onNavigate={() => setOpen(false)}
              />
            ))}

            {/* Sejajar dengan Sidebar: garis pemisah + perisai, bukan kartu. */}
            {isAdmin && (
              <div className="mt-4 space-y-0.5 border-t pt-1">
                <div className="flex items-center gap-1.5 px-2.5 pt-5 pb-1.5 text-xs text-muted-foreground">
                  <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                  <span>Admin</span>
                </div>
                {adminItems.map(({ href, icon: Icon, label }) => (
                  <MobileNavItem
                    key={href}
                    href={href}
                    icon={Icon}
                    label={label}
                    active={pathname.startsWith(href)}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            )}

            {!isAuthenticated && (
              <div className="pt-4">
                <MobileNavItem
                  href="/login"
                  icon={LogIn}
                  label="Login Admin"
                  active={pathname === "/login"}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            )}
          </nav>

          {/* Kaki: identitas, asisten, akun, tema, keluar (urutan sama dengan sidebar). */}
          <SheetFooter className="shrink-0 gap-0.5 border-t px-3 py-3">
            {isAuthenticated && (
              <>
                {userName && (
                  <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-2">
                    <User aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold">{userName}</span>
                  </div>
                )}
                <AIChat />
                <Link
                  href="/admin/account"
                  onClick={() => setOpen(false)}
                  className="flex h-10 items-center rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:bg-accent hover:text-foreground"
                >
                  Akun Saya
                </Link>
              </>
            )}
            <div className="flex h-10 items-center justify-between px-2.5">
              <span className="text-sm text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            {isAuthenticated && <LogoutButton />}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <span className="min-w-0 flex-1 truncate font-display text-base leading-none font-semibold tracking-tight">
        KPI Dashboard
      </span>
      <ThemeToggle />
    </header>
  );
}

function MobileNavItem({
  href,
  icon: Icon,
  label,
  active,
  color,
  onNavigate,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  color?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-2.5 rounded-md pr-2 pl-2.5 text-sm transition-colors duration-[var(--dur-micro)]",
        "before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-0.5 before:rounded-full before:content-['']",
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
