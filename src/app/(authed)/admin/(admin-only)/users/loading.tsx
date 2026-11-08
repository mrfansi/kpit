import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-5xl space-y-10" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b py-3 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-48 sm:block" />
              <Skeleton className="ml-auto size-8" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-t pt-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
