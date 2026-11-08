import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-2 outline-offset-[-3px] outline-transparent placeholder:text-muted-foreground focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
