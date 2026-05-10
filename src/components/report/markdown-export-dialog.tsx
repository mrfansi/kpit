"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MarkdownExportFormat } from "@/lib/report-markdown";

interface MarkdownExportDialogProps {
  period: string;
}

type MarkdownExportScope = "selected" | "all";

const formatOptions: { value: MarkdownExportFormat; label: string }[] = [
  { value: "full", label: "Full AI Report" },
  { value: "brief", label: "Executive Brief" },
  { value: "presentation", label: "Presentation Prompt" },
];

const scopeOptions: { value: MarkdownExportScope; label: string; description: string }[] = [
  { value: "selected", label: "Selected Period", description: "Export the report for the current period only." },
  { value: "all", label: "All Periods", description: "Export all KPI historical entries plus timeline projects." },
];

export function MarkdownExportDialog({ period }: MarkdownExportDialogProps) {
  const [format, setFormat] = useState<MarkdownExportFormat>("full");
  const [scope, setScope] = useState<MarkdownExportScope>("selected");
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ period, format, scope });
    return `/api/report/markdown?${params.toString()}`;
  }, [format, period, scope]);

  async function copyMarkdown() {
    setIsCopying(true);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Export failed");
      await navigator.clipboard.writeText(await response.text());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } finally {
      setIsCopying(false);
    }
  }

  function downloadMarkdown() {
    window.location.href = `${endpoint}&download=1`;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-1.5" />
          Export Markdown
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export Markdown Report</DialogTitle>
          <DialogDescription>
            KPI, action plans, and timeline/Gantt data in English.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Format</p>
          {formatOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormat(option.value)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                format === option.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope</p>
          {scopeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScope(option.value)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                scope === option.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              <span className={`block text-xs ${scope === option.value ? "text-background/70" : "text-muted-foreground"}`}>
                {option.description}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={copyMarkdown} disabled={isCopying}>
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Clipboard className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied" : format === "presentation" ? "Copy Prompt" : "Copy Markdown"}
          </Button>
          <Button onClick={downloadMarkdown}>
            <Download className="w-4 h-4 mr-1.5" />
            Download .md
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
