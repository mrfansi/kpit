import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DomainForm } from "@/components/domain-form";
import { PageHeader } from "@/components/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditDomainPage({ params }: Props) {
  const { id } = await params;
  const domainId = Number(id);
  if (isNaN(domainId)) notFound();

  const [domain] = await db.select().from(domains).where(eq(domains.id, domainId));
  if (!domain) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Edit Domain" description={`Ubah informasi domain "${domain.name}"`} />
      <DomainForm domain={domain} />
    </div>
  );
}
