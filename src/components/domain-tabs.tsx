import type { Domain } from "@/lib/db/schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

interface DomainTabsProps {
  domains: Domain[];
  activeSlug?: string;
}

export function DomainTabs({ domains, activeSlug }: DomainTabsProps) {
  return (
    <Tabs value={activeSlug ?? "all"}>
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="all" asChild>
          <Link href="/">Semua Domain</Link>
        </TabsTrigger>
        {domains.map((d) => (
          <TabsTrigger key={d.id} value={d.slug} asChild>
            <Link href={`/domain/${d.slug}`}>{d.name}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
