import { Skeleton } from "@/components/ui/skeleton";

// Bentuk dokumen laporan: kepala, readout, prosa ringkasan, lalu tabel bergaris.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-8 border-y py-5">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Ringkasan naratif (AI): bagian paling lama dimuat. */}
      <div className="max-w-[65ch] space-y-2.5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="divide-y border-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
