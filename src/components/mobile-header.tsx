"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, TrendingUp, Users, PenLine, Menu, Globe, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface MobileHeaderProps {
  domains: Domain[];
}

const domainIconMap: Record<string, React.ElementType> = {
  TrendingUp, Users, Settings, BarChart2,
};

export function MobileHeader({ domains }: MobileHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems: { href: string; icon: React.ElementType; label: string; color?: string }[] = [
    { href: "/", icon: Home, label: "Overview" },
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
  ];

  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-background sticky top-0 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-56 p-0">
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart2 className="w-5 h-5 text-primary" />
              KPI Dashboard
            </SheetTitle>
          </SheetHeader>
          <nav className="px-2 py-3 space-y-1">
            {navItems.map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors",
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" style={color && pathname !== href ? { color } : undefined} />
                <span className="truncate">{label}</span>
              </Link>
            ))}

            <div className="pt-3 pb-1 px-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</span>
            </div>

            {adminItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 flex-1">
        <BarChart2 className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">KPI Dashboard</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
