import { Skeleton } from "@/components/ui/skeleton";

/** Bentuk yang akan datang: kepala, readout + gauge, grafik, baris perbandingan, tabel riwayat. */
export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-4 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-b pb-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-72" />
        </div>
        <Skeleton className="h-60 w-full" />
        <div className="grid grid-cols-2 divide-x border-t pt-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 px-5 first:pl-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="divide-y border-y">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
