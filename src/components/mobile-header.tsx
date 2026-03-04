"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, Users, User, PenLine, Menu, Globe, Upload, LogIn, ClipboardList, GanttChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { domainIconMap } from "@/lib/domain-icons";

interface MobileHeaderProps {
  domains: Domain[];
  isAuthenticated?: boolean;
  userName?: string | null;
}

export function MobileHeader({ domains, isAuthenticated = false, userName }: MobileHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
    { href: "/admin/import", icon: Upload, label: "Import CSV" },
    { href: "/admin/users", icon: Users, label: "Pengguna" },
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

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {navItems.map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2.5 rounded-md text-sm transition-colors",
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" style={color && pathname !== href ? { color } : undefined} />
                <span className="truncate">{label}</span>
              </Link>
            ))}

            {isAuthenticated ? (
              <>
                <div className="pt-3 pb-1 px-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</span>
                </div>
                {adminItems.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-2.5 rounded-md text-sm transition-colors",
                      pathname.startsWith(href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </>
            ) : (
              <div className="pt-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-2 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Login Admin</span>
                </Link>
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

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <BarChart2 className="w-4 h-4 text-primary shrink-0" />
        <span className="font-semibold text-sm truncate">KPI Dashboard</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
