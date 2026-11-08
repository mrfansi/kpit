import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b py-3 last:border-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="hidden h-4 w-40 sm:block" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
