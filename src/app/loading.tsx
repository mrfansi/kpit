import { Skeleton } from "@/components/ui/skeleton";

// Bentuk yang sama dengan layar yang datang: kepala, readout, lalu baris tabel.
export default function Loading() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Memuat">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-5 border-y py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <Skeleton className="h-10 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-3 w-full rounded-none" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <div className="divide-y border-y">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 py-3.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="hidden h-2 w-32 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
