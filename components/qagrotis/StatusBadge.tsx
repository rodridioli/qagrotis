import * as React from "react"
import { cn } from "@/lib/utils"

type CenarioTipo = "Automatizado" | "Manual" | "Man./Auto."
type SuiteTipo = "Sprint" | "Kanban" | "Outro"

const CENARIO_TIPO_CLASSES: Record<CenarioTipo, string> = {
  Automatizado: "bg-green-100 text-green-700",
  Manual:       "bg-primary-100 text-primary-700",
  "Man./Auto.": "bg-yellow-100 text-yellow-700",
}

const SUITE_TIPO_CLASSES: Record<SuiteTipo, string> = {
  Sprint: "bg-green-100 text-green-700",
  Kanban: "bg-primary-100 text-primary-700",
  Outro:  "bg-yellow-100 text-yellow-700",
}

function StatusBadge({
  label,
  colorClass,
}: {
  label: string
  colorClass: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {label}
    </span>
  )
}

function CenarioTipoBadge({ tipo }: { tipo: CenarioTipo }) {
  return <StatusBadge label={tipo} colorClass={CENARIO_TIPO_CLASSES[tipo]} />
}

function SuiteTipoBadge({ tipo }: { tipo: SuiteTipo }) {
  return <StatusBadge label={tipo} colorClass={SUITE_TIPO_CLASSES[tipo]} />
}

function AutomacaoBadge({ pct }: { pct: number }) {
  let colorClass = "bg-red-100 text-red-700"
  if (pct === 100) colorClass = "bg-green-100 text-green-700"
  else if (pct >= 50) colorClass = "bg-yellow-100 text-yellow-700"
  else if (pct > 0) colorClass = "bg-yellow-100 text-yellow-700"
  return <StatusBadge label={`${pct}%`} colorClass={colorClass} />
}

export { StatusBadge, CenarioTipoBadge, SuiteTipoBadge, AutomacaoBadge }
export type { CenarioTipo, SuiteTipo }
