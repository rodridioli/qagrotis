"use client"

import type { OkrRisco } from "@/features/okrs/lib/okrs-schemas"

const BASE = "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium"

const RISCO_CONFIG: Record<OkrRisco, { label: string; className: string }> = {
  BAIXO:    { label: "Baixo Risco", className: "border-badge-success/30 bg-badge-success/10 text-badge-success-text" },
  ATENCAO:  { label: "Atenção",     className: "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text" },
  EM_RISCO: { label: "Em Risco",    className: "border-badge-orange/30 bg-badge-orange/10 text-badge-orange-text" },
  CRITICO:  { label: "Crítico",     className: "border-destructive/30 bg-destructive/10 text-destructive" },
}

export function OkrRiscoBadge({ risco }: { risco: OkrRisco }) {
  const cfg = RISCO_CONFIG[risco]
  return <span className={`${BASE} ${cfg.className}`}>{cfg.label}</span>
}
