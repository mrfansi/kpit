import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Tinggi kontrol aplikasi 28–40px; pseudo-element ::after memperluas area klik ke ~44px.
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] after:absolute after:content-[''] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 aria-disabled:pointer-events-none aria-disabled:opacity-55 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-ink-2",
        destructive: "bg-destructive text-primary-foreground hover:bg-danger",
        outline: "border-border bg-transparent text-foreground hover:border-edge hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        link: "text-foreground underline decoration-border underline-offset-4 hover:decoration-current",
      },
      size: {
        // Tombol teks sudah lebar; area klik hanya ditinggikan, supaya tidak meluber keluar layar di tepi.
        default: "h-9 px-3.5 after:inset-x-0 after:-inset-y-1 has-[>svg]:px-3",
        xs: "h-7 gap-1 px-2 text-xs after:inset-x-0 after:-inset-y-2 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 after:inset-x-0 after:-inset-y-1.5 has-[>svg]:px-2.5",
        lg: "h-10 px-5 after:inset-x-0 after:-inset-y-0.5 has-[>svg]:px-4",
        icon: "size-9 after:-inset-1",
        "icon-xs": "size-7 after:-inset-2 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 after:-inset-1.5",
        "icon-lg": "size-10 after:-inset-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  // `disabled` hanya berlaku untuk <button>. Saat asChild, anaknya biasanya <a>,
  // yang mengabaikan atribut disabled maupun pseudo-class :disabled — tautan tetap
  // bisa diklik. Terjemahkan ke aria-disabled, yang punya pasangan varian CSS di atas.
  const disabledProps = asChild
    ? { "aria-disabled": disabled || undefined, tabIndex: disabled ? -1 : undefined }
    : { disabled }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...disabledProps}
      {...props}
    />
  )
}

export { Button, buttonVariants }
