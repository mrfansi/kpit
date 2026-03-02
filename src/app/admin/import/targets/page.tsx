"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveTargetCSVRows, importTargetRows, type TargetImportRow } from "@/lib/actions/import-target-csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Target KPI via CSV</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload file CSV untuk mengatur target per periode secara massal</p>
      </div>

      {/* Format */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Format CSV</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
{`kpi_name,period_date,target,threshold_green,threshold_yellow
Revenue Bulanan,2026-01-01,1000000000,900000000,700000000
Win Rate,2026-01-01,75,70,60
Tingkat Keterlambatan,2026-01-01,5,6,8`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Kolom <code className="bg-muted px-1 rounded">threshold_green</code> dan{" "}
            <code className="bg-muted px-1 rounded">threshold_yellow</code> opsional — jika kosong, dihitung otomatis (90% dan 70% dari target).
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

      {parseErrors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" />{parseErrors.length} Error Validasi</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">{parseErrors.map((e, i) => <li key={i} className="text-sm text-destructive">Baris {e.row}: {e.message}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {preview && preview.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Preview — {preview.length} target siap diimport
            </CardTitle>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? "Mengimport..." : "Konfirmasi Import"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Threshold Hijau</TableHead>
                    <TableHead className="text-right">Threshold Kuning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((row) => (
                    <TableRow key={`${row.kpiId}-${row.periodDate}`}>
                      <TableCell className="font-medium">{row.kpiName}</TableCell>
                      <TableCell>{row.periodDate}</TableCell>
                      <TableCell className="text-right">{row.target}</TableCell>
                      <TableCell className="text-right text-green-600">{row.thresholdGreen}</TableCell>
                      <TableCell className="text-right text-yellow-600">{row.thresholdYellow}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={result.errors.length === 0 ? "border-green-500" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold">Import Selesai</p>
                <p className="text-sm text-muted-foreground">
                  <Badge variant="secondary" className="mr-1">{result.imported} berhasil</Badge>
                  {result.errors.length > 0 && <Badge variant="destructive">{result.errors.length} gagal</Badge>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
