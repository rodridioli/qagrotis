"use client"

import { cn } from "@/core/utils"
import type { OkrSituacaoDto, OkrObjetivoSituacaoDto, OkrKrSituacaoDto } from "@/features/okrs/lib/okrs-schemas"

type SituacaoBadgeVariant = OkrSituacaoDto | OkrObjetivoSituacaoDto | OkrKrSituacaoDto

const VARIANT_CONFIG: Record<string, { label: string; className: string }> = {
  ATIVO:     { label: "Ativo",     className: "bg-primary/10 text-primary" },
  ENCERRADO: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
  CANCELADO: { label: "Cancelado", className: "bg-destructive/10 text-destructive" },
}

export function OkrSituacaoBadge({ situacao }: { situacao: SituacaoBadgeVariant }) {
  const cfg = VARIANT_CONFIG[situacao] ?? VARIANT_CONFIG.ATIVO
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
