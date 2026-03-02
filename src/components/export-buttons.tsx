"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface ExportButtonsProps {
  domainSlug?: string;
}

export function ExportButtons({ domainSlug }: ExportButtonsProps) {
  function handleCSV() {
    const params = new URLSearchParams();
    if (domainSlug) params.set("domain", domainSlug);
    window.location.href = `/api/export/csv?${params.toString()}`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={handleCSV}>
        <Download className="w-4 h-4 mr-1.5" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="w-4 h-4 mr-1.5" />
        Print / PDF
      </Button>
    </div>
  );
}
