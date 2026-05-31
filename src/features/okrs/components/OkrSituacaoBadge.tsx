"use client"

import type { OkrSituacaoDto, OkrObjetivoSituacaoDto, OkrKrSituacaoDto } from "@/features/okrs/lib/okrs-schemas"

type SituacaoBadgeVariant = OkrSituacaoDto | OkrObjetivoSituacaoDto | OkrKrSituacaoDto

const BASE = "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium"

const VARIANT_CONFIG: Record<string, { label: string; className: string }> = {
  ATIVO:     { label: "Ativo",     className: "border-badge-success/30 bg-badge-success/10 text-badge-success-text" },
  ENCERRADO: { label: "Encerrado", className: "border-border-default bg-neutral-grey-50 text-text-secondary" },
  CANCELADO: { label: "Cancelado", className: "border-destructive/30 bg-destructive/10 text-destructive" },
}

export function OkrSituacaoBadge({ situacao }: { situacao: SituacaoBadgeVariant }) {
  const cfg = VARIANT_CONFIG[situacao] ?? VARIANT_CONFIG.ATIVO
  return <span className={`${BASE} ${cfg.className}`}>{cfg.label}</span>
}
