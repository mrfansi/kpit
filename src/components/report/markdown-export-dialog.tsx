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
  domains?: { slug: string; name: string }[];
  selectedDomain?: string;
}

type MarkdownExportScope = "selected" | "all";

// Daftar radio: baris setinggi kontrol (36px), pilihan ditandai radio, bukan blok terisi.
const optionRow = "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-[var(--dur-micro)] hover:bg-accent";
const radio = "size-4 shrink-0 accent-foreground";

const formatOptions: { value: MarkdownExportFormat; label: string }[] = [
  { value: "full", label: "Full AI report" },
  { value: "brief", label: "Executive brief" },
  { value: "presentation", label: "Presentation prompt" },
];

const scopeOptions: { value: MarkdownExportScope; label: string; description: string }[] = [
  { value: "selected", label: "Selected period", description: "Export the report for the current period only." },
  { value: "all", label: "All periods", description: "Export all KPI historical entries plus timeline projects." },
];

export function MarkdownExportDialog({ period, domains = [], selectedDomain = "" }: MarkdownExportDialogProps) {
  const [format, setFormat] = useState<MarkdownExportFormat>("full");
  const [scope, setScope] = useState<MarkdownExportScope>("selected");
  const [domain, setDomain] = useState(selectedDomain);
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ period, format });
    if (format === "presentation") params.set("domain", domain);
    else if (selectedDomain) params.set("domain", selectedDomain);
    else params.set("scope", scope);
    return `/api/report/markdown?${params.toString()}`;
  }, [format, period, scope, domain, selectedDomain]);

  async function copyMarkdown() {
    setIsCopying(true);
    setError("");
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || `Export gagal (${response.status}).`);
      }
      await navigator.clipboard.writeText(await response.text());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyalin laporan.");
    } finally {
      setIsCopying(false);
    }
  }

  function downloadMarkdown() {
    if (format === "presentation" && !domain) return;
    window.location.href = `${endpoint}&download=1`;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileText aria-hidden />
          Export Markdown
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export Markdown report</DialogTitle>
          <DialogDescription>
            {format === "presentation"
              ? "Pilih satu divisi untuk prompt presentasi dari laporan bulanan tersimpan."
              : selectedDomain ? "Laporan bulanan domain terpilih." : "KPI, action plans, and timeline/Gantt data in English."}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="grid gap-1">
          <legend className="mb-1.5 text-sm text-muted-foreground">Format</legend>
          {formatOptions.map((option) => (
            <label key={option.value} className={optionRow}>
              <input
                type="radio"
                name="markdown-export-format"
                value={option.value}
                checked={format === option.value}
                onChange={() => setFormat(option.value)}
                className={radio}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        {format === "presentation" ? (
          <label className="grid gap-1.5 text-sm text-muted-foreground">Domain presentasi
            <select className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-2 outline-offset-[-3px] outline-transparent focus-visible:outline-ring" value={domain} onChange={(event) => setDomain(event.target.value)}>
              <option value="">Pilih domain</option>
              {domains.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
        ) : !selectedDomain && (
          <fieldset className="grid gap-1">
            <legend className="mb-1.5 text-sm text-muted-foreground">Scope</legend>
            {scopeOptions.map((option) => (
              <label key={option.value} className="flex min-h-9 cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-sm transition-colors duration-[var(--dur-micro)] hover:bg-accent">
                <input
                  type="radio"
                  name="markdown-export-scope"
                  value={option.value}
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                  className={`${radio} mt-0.5`}
                />
                <span>
                  <span className="block">{option.label}</span>
                  <span className="block text-sm text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={copyMarkdown} disabled={isCopying || (format === "presentation" && !domain)}>
            {copied ? <Check aria-hidden /> : <Clipboard aria-hidden />}
            {copied ? "Copied" : format === "presentation" ? "Copy prompt" : "Copy Markdown"}
          </Button>
          <Button type="button" onClick={downloadMarkdown} disabled={format === "presentation" && !domain}>
            <Download aria-hidden />
            Download .md
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
