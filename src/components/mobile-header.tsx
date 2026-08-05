"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, Users, User, PenLine, Menu, Globe, Upload, LogIn, ClipboardList, ClipboardCheck, GanttChart } from "lucide-react";
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
    { href: "/admin/import", icon: Upload, label: "Import CSV" },
    { href: "/admin/users", icon: Users, label: "Pengguna" },
    { href: "/admin/timeline", icon: GanttChart, label: "Kelola Timeline" },
    { href: "/admin/audit", icon: ClipboardList, label: "Audit Log" },
  ];

  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-background sticky top-0 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 sm:max-w-xs p-0 flex flex-col" showCloseButton={false}>
          <SheetHeader className="shrink-0 px-4 py-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart2 className="w-5 h-5 text-primary" />
              KPI Dashboard
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
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

            {isAdmin && (
              <div className="mt-4 rounded-lg bg-sidebar-accent/40 p-1.5 ring-1 ring-sidebar-border">
                <div className="px-2 pt-1 pb-1">
                  <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Admin
                  </span>
                </div>
                <div className="space-y-1">
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
              </div>
            )}

            {!isAuthenticated && (
              <div className="pt-3">
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

          {/* Footer: theme + user info */}
          <SheetFooter className="shrink-0 border-t px-3 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            {isAuthenticated && (
              <div className="space-y-1.5 pt-2 border-t">
                {userName && (
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{userName}</span>
                  </div>
                )}
                <AIChat />
                <Link
                  href="/admin/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Akun Saya
                </Link>
                <LogoutButton />
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BarChart2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold">KPI Dashboard</span>
      </div>
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
        "relative flex items-center gap-2.5 rounded-md py-2.5 pr-2 pl-3 text-sm transition-colors",
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
