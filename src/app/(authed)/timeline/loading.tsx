import { Skeleton } from "@/components/ui/skeleton";

// Bentuk yang akan datang: toolbar, lalu daftar project di kiri dan bar di kanvas.
export default function TimelineLoading() {
  const bars = [
    { left: "4%", width: "38%" },
    { left: "18%", width: "30%" },
    { left: "30%", width: "44%" },
    { left: "10%", width: "24%" },
    { left: "46%", width: "34%" },
  ];

  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-28 motion-reduce:animate-none" />
          <Skeleton className="h-8 w-32 motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
      </div>
      <div className="flex">
        <div className="w-[280px] shrink-0 border-r">
          {bars.map((_, i) => (
            <div key={i} className="flex h-[52px] flex-col justify-center gap-2 border-b px-3">
              <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
              <Skeleton className="h-2 w-full rounded-none motion-reduce:animate-none" />
            </div>
          ))}
        </div>
        <div className="relative flex-1">
          {bars.map((bar, i) => (
            <div key={i} className="relative h-[52px] border-b">
              <Skeleton
                className="absolute inset-y-1 rounded-sm motion-reduce:animate-none"
                style={{ left: bar.left, width: bar.width }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
