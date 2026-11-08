"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { resolveCSVRows, importCSVRows, type ImportRow } from "@/lib/actions/import-csv";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ArrowRight, Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type PreviewRow = ImportRow & { rowIndex: number };

export default function ImportPage() {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      startTransition(async () => {
        const { resolved, errors } = await resolveCSVRows(text);
        setPreview(resolved);
        setParseErrors(errors);
        setResult(null);
      });
    };
    reader.readAsText(file);
  }

  const overwriteCount = preview?.filter((r) => r.existingValue !== undefined).length ?? 0;

  function handleImport() {
    if (!preview?.length) return;
    startTransition(async () => {
      const res = await importCSVRows(preview);
      setResult(res);
      setPreview(null);
      setParseErrors([]);
      toast.success(`${res.imported} data berhasil diimport`);
    });
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Import Data CSV"
        description="Upload file CSV untuk memasukkan data KPI secara massal"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/import/targets">
              Import target
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* Langkah 1: apa yang harus ada di file */}
      <section aria-labelledby="step-format" className="space-y-3">
        <h2 id="step-format" className="flex items-baseline gap-2.5 text-lg font-semibold">
          <span className="num text-muted-foreground">1</span>
          Format CSV yang diharapkan
        </h2>
        <p className="max-w-prose text-muted-foreground">Header wajib (pilih salah satu untuk identifikasi KPI):</p>
        <pre className="max-w-prose overflow-x-auto rounded-card bg-paper-2 p-4 font-outlier text-sm">
{`kpi_name,period_date,value,note
Revenue Bulanan,2026-01-01,850000000,Target tercapai
Win Rate,2026-01-01,72.5,
Tingkat Keterlambatan,2026-01-01,3.2,`}
        </pre>
        <p className="max-w-prose text-muted-foreground">
          Atau gunakan <code>kpi_id</code> sebagai pengganti <code>kpi_name</code>.
          Kolom <code>note</code> opsional.
          Format <code>period_date</code>: YYYY-MM-DD (awal bulan).
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
            <span>Preview: <span className="num">{preview.length}</span> baris siap diimport</span>
          </h2>
          {overwriteCount > 0 && (
            <p className="flex max-w-prose items-center gap-2 rounded-card bg-warning-soft px-3 py-2 text-sm text-warning">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              <span>
                <span className="num font-semibold">{overwriteCount}</span> entri akan <span className="font-semibold">DITIMPA</span>: data lama pada baris ini akan hilang.
              </span>
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Baris</TableHead>
                <TableHead>KPI</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
                <TableHead className="hidden pr-0 sm:table-cell">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.slice(0, 50).map((row) => {
                const willOverwrite = row.existingValue !== undefined;
                return (
                  <TableRow key={`${row.kpiId}-${row.periodDate}`} className={willOverwrite ? "bg-warning-soft" : undefined}>
                    <TableCell className="num pl-0 text-muted-foreground">{row.rowIndex}</TableCell>
                    <TableCell className="font-semibold">{row.kpiName}</TableCell>
                    <TableCell className="num">{row.periodDate}</TableCell>
                    <TableCell className="num text-right">
                      {willOverwrite ? (
                        <span className="text-warning">
                          {row.existingValue} → {row.value}
                        </span>
                      ) : (
                        row.value
                      )}
                    </TableCell>
                    <TableCell className="hidden pr-0 text-muted-foreground sm:table-cell">{row.note ?? "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center gap-3">
            {preview.length > 50 && (
              <p className="text-sm text-muted-foreground">…dan <span className="num">{preview.length - 50}</span> baris lainnya</p>
            )}
            <Button type="button" className="ml-auto" onClick={handleImport} disabled={isPending}>
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
            {result.skipped > 0 && <Badge variant="outline"><span className="num">{result.skipped}</span> dilewati</Badge>}
          </p>
          {result.errors.length > 0 && (
            <div role="alert" className="max-w-prose space-y-2 rounded-card bg-danger-soft px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                <XCircle aria-hidden className="size-4 shrink-0" />
                <span><span className="num">{result.errors.length}</span> baris gagal diimport</span>
              </p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-sm text-danger">Baris <span className="num">{e.row}</span>: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
