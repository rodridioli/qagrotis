import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.ComponentProps<"input"> {
  label?: string
}

function Checkbox({ className, label, id, ...props }: CheckboxProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        className={cn(
          "size-4 rounded border border-border-default bg-surface-input accent-brand-primary cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {label && (
        <span className="text-sm text-text-primary select-none">{label}</span>
      )}
    </label>
  )
}

export { Checkbox }
