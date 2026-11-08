import type { Domain } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface DomainTabsProps {
  domains: Domain[];
  activeSlug?: string;
}

export function DomainTabs({ domains, activeSlug }: DomainTabsProps) {
  const items = [{ key: "all", href: "/", label: "Semua Domain" }, ...domains.map((d) => ({ key: d.slug, href: `/domain/${d.slug}`, label: d.name }))];
  const active = activeSlug ?? "all";
  return (
    <nav aria-label="Domain" className="inline-flex h-auto w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-md bg-muted p-0.5 text-muted-foreground">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center justify-center rounded-sm border border-transparent px-2.5 py-1 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:text-foreground",
            item.key === active && "border-border bg-card font-semibold text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
