import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <span
      className={cn(
        "keep-motion inline-block size-3 rounded-full border-2 border-border border-t-muted-foreground animate-spin",
        className
      )}
      aria-hidden="true"
    />
  );
}
