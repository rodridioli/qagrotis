"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Zod / form error message displayed below the textarea */
  error?: string
}

function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <div className="flex w-full flex-col gap-1">
      <textarea
        data-slot="textarea"
        aria-invalid={!!error}
        className={cn(
          "flex min-h-20 w-full rounded-custom border px-3 py-2 text-sm outline-none transition-colors",
          "border-border-default bg-surface-input text-text-primary",
          "placeholder:text-text-secondary",
          "focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20",
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
}

export { Textarea }
