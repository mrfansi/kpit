"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function ReportPrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer aria-hidden />
      Print / Save PDF
    </Button>
  );
}
