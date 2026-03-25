import * as React from "react"
import { cn } from "@/lib/utils"

type CenarioTipo = "Automatizado" | "Manual" | "Man./Auto."
type SuiteTipo = "Sprint" | "Kanban" | "Outro"

const CENARIO_TIPO_CLASSES: Record<CenarioTipo, string> = {
  Automatizado: "border border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
  Manual:       "border border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
  "Man./Auto.": "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
}

const SUITE_TIPO_CLASSES: Record<SuiteTipo, string> = {
  Sprint: "border border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
  Kanban: "border border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
  Outro:  "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
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
  let colorClass: string
  if (pct === 100) colorClass = "border border-green-600/30 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-900/30 dark:text-green-400"
  else if (pct >= 50) colorClass = "border border-amber-500/30 bg-amber-100 text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-400"
  else if (pct > 0) colorClass = "border border-orange-500/30 bg-orange-100 text-orange-700 dark:border-orange-400/30 dark:bg-orange-900/30 dark:text-orange-400"
  else colorClass = "border border-red-500/30 bg-red-100 text-red-700 dark:border-red-400/30 dark:bg-red-900/30 dark:text-red-400"
  return <StatusBadge label={`${pct}%`} colorClass={colorClass} />
}

export { StatusBadge, CenarioTipoBadge, SuiteTipoBadge, AutomacaoBadge }
export type { CenarioTipo, SuiteTipo }
