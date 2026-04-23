"use client"

import { cn } from "@/lib/utils"

export interface RankingPositionBadgeProps {
  /** Posição exibida (1 = primeiro lugar). */
  position: number
  className?: string
}

/**
 * Selo de posição no pódio (1°–3°) padronizado entre ranking da equipe e dashboard.
 */
export function RankingPositionBadge({ position, className }: RankingPositionBadgeProps) {
  const label = `${position}°`
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:min-w-[2rem] sm:px-2 sm:text-[11px]",
        position === 1 &&
          "bg-brand-primary text-primary-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        position === 2 &&
          "border border-primary-200/60 bg-primary-50 text-brand-primary dark:border-primary-300/25 dark:bg-primary-100/40",
        position === 3 &&
          "border border-border-default bg-neutral-grey-50 text-text-primary dark:bg-neutral-grey-100/80",
        position > 3 && "bg-neutral-grey-100 text-text-secondary dark:bg-neutral-grey-100/60 dark:text-text-secondary",
        className,
      )}
      aria-hidden
    >
      {label}
    </span>
  )
}
