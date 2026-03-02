"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Home, TrendingUp, Users, PenLine, Globe, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/db/schema";
import { ThemeToggle } from "@/components/theme-toggle";

interface SidebarProps {
  domains: Domain[];
}

const domainIconMap: Record<string, React.ElementType> = {
  TrendingUp,
  Users,
  Settings,
  BarChart2,
};

export function Sidebar({ domains }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-background flex flex-col min-h-screen print:hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b">
        <BarChart2 className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">KPI Dashboard</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        <NavItem href="/" icon={Home} label="Overview" active={pathname === "/"} />

        <div className="pt-3 pb-1 px-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Domain</span>
        </div>

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

        <div className="pt-3 pb-1 px-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</span>
        </div>
        <NavItem href="/admin/kpi" icon={Settings} label="Kelola KPI" active={pathname.startsWith("/admin/kpi")} />
        <NavItem href="/admin/domain" icon={Globe} label="Kelola Domain" active={pathname.startsWith("/admin/domain")} />
        <NavItem href="/admin/input" icon={PenLine} label="Input Data" active={pathname === "/admin/input"} />
        <NavItem href="/admin/import" icon={Upload} label="Import CSV" active={pathname === "/admin/import"} />
      </nav>

      {/* Footer: theme toggle */}
      <div className="px-3 py-3 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Tema</span>
        <ThemeToggle />
      </div>
    </aside>
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
      className={cn(
        "flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" style={color && !active ? { color } : undefined} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
