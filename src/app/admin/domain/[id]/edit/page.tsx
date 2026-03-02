import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DomainForm } from "@/components/domain-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Domain</h1>
        <p className="text-muted-foreground text-sm mt-1">Ubah informasi domain &ldquo;{domain.name}&rdquo;</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Informasi Domain</CardTitle></CardHeader>
        <CardContent>
          <DomainForm domain={domain} />
        </CardContent>
      </Card>
    </div>
  );
}
