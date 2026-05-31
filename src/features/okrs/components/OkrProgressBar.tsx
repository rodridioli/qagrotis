"use client"

import { cn } from "@/core/utils"

interface OkrProgressBarProps {
  value: number
  max?: number
  showLabel?: boolean
  className?: string
}

function progressColor(pct: number): string {
  if (pct >= 70) return "bg-primary"
  if (pct >= 40) return "bg-amber-500"
  return "bg-destructive"
}

export function OkrProgressBar({ value, max = 100, showLabel = false, className }: OkrProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-300", progressColor(pct))}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className="w-10 text-right text-xs font-medium tabular-nums text-text-secondary">
          {pct.toFixed(0)}%
        </span>
      )}
    </div>
  )
}
