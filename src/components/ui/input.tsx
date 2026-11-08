import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Tepi konstan (3:1); fokus = outline inset, tidak pernah perubahan border.
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base transition-colors duration-[var(--dur-micro)] outline-2 outline-offset-[-3px] outline-transparent file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-55 md:text-sm",
        "focus-visible:outline-ring",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
