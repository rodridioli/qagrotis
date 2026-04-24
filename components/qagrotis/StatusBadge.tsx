import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Base ────────────────────────────────────────────────────────────────────
// Single source of truth for badge layout — never change sizing here,
// only pass color classes via the second argument.
const BASE = "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium"

function badge(colorClass: string, label: React.ReactNode) {
  return <span className={`${BASE} ${colorClass}`}>{label}</span>
}

// ─── Types ───────────────────────────────────────────────────────────────────
type CenarioTipo    = "Automatizado" | "Manual" | "Man./Auto."
type SuiteTipo      = "Sprint" | "Kanban" | "Outro"
type SuiteSituacao  = "Planejada" | "Em andamento" | "Concluída"
type ChangelogTag = "Novidade" | "Melhoria" | "Correção"

// ─── Components ──────────────────────────────────────────────────────────────
function CenarioTipoBadge({ tipo }: { tipo: CenarioTipo }) {
  const styles: Record<CenarioTipo, string> = {
    "Automatizado": "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    "Manual":       "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    "Man./Auto.":   "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  }
  return badge(styles[tipo] ?? "border-border-default bg-neutral-grey-50 text-text-secondary", tipo)
}

function SuiteSituacaoBadge({ situacao }: { situacao: SuiteSituacao }) {
  const styles: Record<SuiteSituacao, string> = {
    "Planejada":    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300",
    "Em andamento": "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-400",
    "Concluída":    "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
  }
  return badge(styles[situacao], situacao)
}

function SuiteTipoBadge({ tipo }: { tipo: SuiteTipo }) {
  const styles: Record<SuiteTipo, string> = {
    "Sprint": "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    "Kanban": "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    "Outro":  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  }
  return badge(styles[tipo] ?? "border-border-default bg-neutral-grey-50 text-text-secondary", tipo)
}

function AutomacaoBadge({ pct }: { pct: number }) {
  const colorClass =
    pct === 100 ? "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400" :
    pct > 0     ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400" :
                  "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, `${pct}%`)
}

function UserTipoBadge({ tipo }: { tipo: string }) {
  const colorClass =
    tipo === "Administrador"
      ? "border-brand-primary/30 bg-brand-primary/10 text-brand-primary"
      : "border-secondary-500/30 bg-secondary-500/10 text-secondary-600"
  return badge(colorClass, tipo)
}

function PriorityBadge({ priority }: { priority: string }) {
  const colorClass =
    priority === "Crítica"
      ? "border-red-500/30 bg-red-500/10 text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400"
      : "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400"
  return badge(colorClass, priority)
}

function ChangelogTagBadge({ tag }: { tag: string }) {
  const styles: Record<string, string> = {
    "Novidade": "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    "Melhoria": "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    "Correção": "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  }
  const colorClass = styles[tag] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, tag)
}

function StatusBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={cn(BASE, colorClass)}>{label}</span>
}

type ResultadoTipo = "Sucesso" | "Erro" | "Pendente" | "Alerta"

function ResultadoBadge({ resultado }: { resultado: ResultadoTipo | string }) {
  const styles: Record<string, string> = {
    Sucesso:  "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
    Erro:     "border-red-500/30 bg-red-500/10 text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400",
    Pendente: "border-orange-500/35 bg-orange-500/10 text-orange-800 dark:border-orange-400/35 dark:bg-orange-400/10 dark:text-orange-300",
    Alerta:   "border-yellow-500/50 bg-yellow-400/15 text-yellow-950 dark:border-yellow-400/45 dark:bg-yellow-400/12 dark:text-yellow-200",
  }
  const s = styles[resultado] ?? "border-border-default bg-neutral-grey-100 text-text-secondary"
  return badge(s, resultado)
}

export {
  StatusBadge,
  ResultadoBadge,
  CenarioTipoBadge,
  SuiteTipoBadge,
  SuiteSituacaoBadge,
  AutomacaoBadge,
  UserTipoBadge,
  PriorityBadge,
  ChangelogTagBadge,
}
export type { CenarioTipo, SuiteTipo, SuiteSituacao, ChangelogTag, ResultadoTipo }
