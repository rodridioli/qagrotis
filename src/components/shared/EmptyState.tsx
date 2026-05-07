import { cn } from "@/core/utils"

interface EmptyStateProps {
  message: string
  className?: string
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary",
        className
      )}
    >
      {message}
    </div>
  )
}
