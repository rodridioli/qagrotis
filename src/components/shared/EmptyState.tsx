import { cn } from "@/core/utils"

interface EmptyStateProps {
  message: string
  className?: string
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-4 my-6 flex flex-col items-center rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-text-secondary">{message}</p>
    </div>
  )
}
