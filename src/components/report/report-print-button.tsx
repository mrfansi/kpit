"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function ReportPrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="w-3.5 h-3.5 mr-1.5" />
      Print / Save PDF
    </Button>
  );
}
