import { Skeleton } from "@/components/ui/skeleton";

/** Bentuk daftar admin: kepala layar (judul + konteks, toolbar kanan) lalu baris tabel berpemisah garis. */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div>
        <div className="flex gap-4 border-b pb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b py-3 last:border-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="hidden h-4 w-1/4 sm:block" />
            <Skeleton className="ml-auto size-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
