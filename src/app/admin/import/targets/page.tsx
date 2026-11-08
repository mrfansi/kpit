"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveTargetCSVRows, importTargetRows, type TargetImportRow } from "@/lib/actions/import-target-csv";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export default function ImportTargetsPage() {
  const [preview, setPreview] = useState<TargetImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      startTransition(async () => {
        const { resolved, errors } = await resolveTargetCSVRows(text);
        setPreview(resolved);
        setParseErrors(errors);
        setResult(null);
      });
    };
    reader.readAsText(file);
  }

  const overwriteCount = preview?.filter((r) => r.existingTarget !== undefined).length ?? 0;

  function handleImport() {
    if (!preview?.length) return;
    startTransition(async () => {
      const res = await importTargetRows(preview);
      setResult(res);
      setPreview(null);
      setParseErrors([]);
      toast.success(`${res.imported} target berhasil diimport`);
    });
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Import Target KPI via CSV"
        description="Upload file CSV untuk mengatur target per periode secara massal"
      />

      {/* Langkah 1: apa yang harus ada di file */}
      <section aria-labelledby="step-format" className="space-y-3">
        <h2 id="step-format" className="flex items-baseline gap-2.5 text-lg font-semibold">
          <span className="num text-muted-foreground">1</span>
          Format CSV
        </h2>
        <pre className="max-w-prose overflow-x-auto rounded-card bg-paper-2 p-4 font-outlier text-sm">
{`kpi_name,period_date,target,threshold_green,threshold_yellow
Revenue Bulanan,2026-01-01,1000000000,900000000,700000000
Win Rate,2026-01-01,75,70,60
Tingkat Keterlambatan,2026-01-01,5,6,8`}
        </pre>
        <p className="max-w-prose text-muted-foreground">
          Kolom <code>threshold_green</code> dan <code>threshold_yellow</code> opsional. Jika kosong, dihitung otomatis (90% dan 70% dari target).
        </p>
      </section>

      {/* Langkah 2: berkas */}
      <section aria-labelledby="step-upload" className="space-y-3">
        <h2 id="step-upload" className="flex items-baseline gap-2.5 text-lg font-semibold">
          <span className="num text-muted-foreground">2</span>
          Upload file
        </h2>
        {/* Input asli tetap bisa difokus (sr-only); bingkai label menampilkan fokusnya. */}
        <label className="flex h-32 w-full max-w-prose cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-edge bg-card transition-colors duration-[var(--dur-micro)] hover:bg-accent has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-55 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring">
          <Upload aria-hidden className="size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Klik untuk pilih file CSV</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} disabled={isPending} />
        </label>

        {parseErrors.length > 0 && (
          <div role="alert" className="max-w-prose space-y-2 rounded-card bg-danger-soft px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-danger">
              <XCircle aria-hidden className="size-4 shrink-0" />
              <span><span className="num">{parseErrors.length}</span> error validasi</span>
            </p>
            <ul className="space-y-1">
              {parseErrors.map((e, i) => (
                <li key={i} className="text-sm text-danger">Baris <span className="num">{e.row}</span>: {e.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Langkah 3: pratinjau dan konfirmasi */}
      {preview && preview.length > 0 && (
        <section aria-labelledby="step-preview" className="space-y-4">
          <h2 id="step-preview" className="flex items-baseline gap-2.5 text-lg font-semibold">
            <span className="num text-muted-foreground">3</span>
            <span>Preview: <span className="num">{preview.length}</span> target siap diimport</span>
          </h2>
          {overwriteCount > 0 && (
            <p className="flex max-w-prose items-center gap-2 rounded-card bg-warning-soft px-3 py-2 text-sm text-warning">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              <span>
                <span className="num font-semibold">{overwriteCount}</span> target akan <span className="font-semibold">DITIMPA</span>: nilai lama pada baris ini akan hilang.
              </span>
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">KPI</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Threshold hijau</TableHead>
                <TableHead className="pr-0 text-right">Threshold kuning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.slice(0, 50).map((row) => {
                const willOverwrite = row.existingTarget !== undefined;
                return (
                  <TableRow key={`${row.kpiId}-${row.periodDate}`} className={willOverwrite ? "bg-warning-soft" : undefined}>
                    <TableCell className="pl-0 font-semibold">{row.kpiName}</TableCell>
                    <TableCell className="num">{row.periodDate}</TableCell>
                    <TableCell className="num text-right">
                      {willOverwrite ? (
                        <span className="text-warning">
                          {row.existingTarget} → {row.target}
                        </span>
                      ) : (
                        row.target
                      )}
                    </TableCell>
                    <TableCell className="num text-right text-success">{row.thresholdGreen}</TableCell>
                    <TableCell className="num pr-0 text-right text-warning">{row.thresholdYellow}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end">
            <Button type="button" onClick={handleImport} disabled={isPending}>
              {isPending ? "Mengimport…" : "Konfirmasi import"}
            </Button>
          </div>
        </section>
      )}

      {/* Hasil */}
      {result && (
        <section aria-labelledby="import-result" className="space-y-3">
          <h2 id="import-result" className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 aria-hidden className="size-4 text-success" />
            Import selesai
          </h2>
          <p className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary"><span className="num">{result.imported}</span> berhasil</Badge>
            {result.errors.length > 0 && <Badge variant="destructive"><span className="num">{result.errors.length}</span> gagal</Badge>}
          </p>
        </section>
      )}
    </div>
  );
}
