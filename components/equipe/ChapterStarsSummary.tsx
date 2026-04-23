"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

/** Resumo compacto: estrelas (arredondadas) + média e contagem. */
export function ChapterStarsSummary({
  avg,
  count,
  className,
}: {
  avg: number | null
  count: number
  className?: string
}) {
  const display = avg != null ? avg.toFixed(1).replace(".", ",") : "—"
  const rounded = avg != null ? Math.min(5, Math.max(0, Math.round(avg))) : 0
  return (
    <div className={cn("flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2", className)}>
      <div className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5 shrink-0 sm:size-4",
              i <= rounded ? "fill-amber-400 text-amber-500" : "text-neutral-grey-300",
            )}
            strokeWidth={1.4}
          />
        ))}
      </div>
      <span className="text-xs text-text-secondary tabular-nums">
        {display}
        {count > 0 ? ` · ${count} ${count === 1 ? "nota" : "notas"}` : ""}
      </span>
    </div>
  )
}
