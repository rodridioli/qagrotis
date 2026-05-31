"use client"

import { cn } from "@/core/utils"
import type { OkrRisco } from "@/features/okrs/lib/okrs-schemas"

const RISCO_CONFIG: Record<OkrRisco, { label: string; className: string }> = {
  BAIXO:    { label: "Baixo Risco", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  ATENCAO:  { label: "Atenção",     className: "bg-amber-400/10 text-amber-600 dark:text-amber-400" },
  EM_RISCO: { label: "Em Risco",    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  CRITICO:  { label: "Crítico",     className: "bg-destructive/15 text-destructive" },
}

export function OkrRiscoBadge({ risco }: { risco: OkrRisco }) {
  const cfg = RISCO_CONFIG[risco]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  )
}
