"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveCSVRows, importCSVRows, type ImportRow } from "@/lib/actions/import-csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Import Data CSV</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload file CSV untuk memasukkan data KPI secara massal</p>
        </div>
        <a href="/admin/import/targets" className="text-sm text-primary underline underline-offset-2 shrink-0">
          Import Target →
        </a>
      </div>

      {/* Format panduan */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Format CSV yang Diharapkan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Header wajib (pilih salah satu untuk identifikasi KPI):</p>
          <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
{`kpi_name,period_date,value,note
Revenue Bulanan,2026-01-01,850000000,Target tercapai
Win Rate,2026-01-01,72.5,
Tingkat Keterlambatan,2026-01-01,3.2,`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Atau gunakan <code className="bg-muted px-1 rounded">kpi_id</code> sebagai pengganti <code className="bg-muted px-1 rounded">kpi_name</code>.
            Kolom <code className="bg-muted px-1 rounded">note</code> opsional.
            Format <code className="bg-muted px-1 rounded">period_date</code>: YYYY-MM-DD (awal bulan).
          </p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Upload File</CardTitle></CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Klik untuk pilih file CSV</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={isPending} />
          </label>
        </CardContent>
      </Card>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" />{parseErrors.length} Error Validasi</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {parseErrors.map((e, i) => (
                <li key={i} className="text-sm text-destructive">Baris {e.row}: {e.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Preview — {preview.length} baris siap diimport
            </CardTitle>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? "Mengimport..." : "Konfirmasi Import"}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Baris</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 50).map((row) => (
                  <TableRow key={`${row.kpiId}-${row.periodDate}`}>
                    <TableCell className="text-muted-foreground text-xs">{row.rowIndex}</TableCell>
                    <TableCell className="font-medium">{row.kpiName}</TableCell>
                    <TableCell>{row.periodDate}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">...dan {preview.length - 50} baris lainnya</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <Card className="border-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold">Import Selesai</p>
                  <p className="text-sm text-muted-foreground">
                    <Badge variant="secondary" className="mr-1">{result.imported} berhasil</Badge>
                    {result.skipped > 0 && <Badge variant="outline">{result.skipped} dilewati</Badge>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {result.errors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader><CardTitle className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" />{result.errors.length} Baris Gagal Diimport</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-sm text-destructive">Baris {e.row}: {e.message}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
