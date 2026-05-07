"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  /** Zod / form error message displayed below the input */
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, type, error, ...props }, ref) {
  return (
    <div className="flex w-full flex-col gap-1">
      <input
        ref={ref}
        type={type}
        data-slot="input"
        aria-invalid={!!error}
        className={cn(
          // Layout & shape
          "flex h-9 w-full rounded-custom border px-3 py-1 text-sm outline-none transition-colors",
          // Token-based colours
          "border-border-default bg-surface-input text-text-primary",
          // Placeholder
          "placeholder:text-text-secondary",
          // Focus ring using brand-primary token
          "focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20",
          // Error state
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // File input reset
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

export { Input }
