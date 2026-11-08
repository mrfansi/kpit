import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full max-w-xs" />
        </div>
        {/* Bentuk tabel: baris kepala lalu baris data berpemisah garis. */}
        <div>
          <Skeleton className="mb-3 h-4 w-full max-w-md" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-t py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
