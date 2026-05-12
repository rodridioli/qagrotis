import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/core/utils"

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  message: string
  className?: string
  icon?: LucideIcon
  description?: string
  action?: EmptyStateAction
}

export function EmptyState({ message, className, icon: Icon, description, action }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-4 my-6 flex flex-col items-center gap-3 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center",
        className
      )}
    >
      {Icon && <Icon className="size-8 text-text-tertiary" aria-hidden />}
      <p className="text-sm font-medium text-text-secondary">{message}</p>
      {description && <p className="text-xs text-text-tertiary">{description}</p>}
      {action && (
        <Button size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  )
}
