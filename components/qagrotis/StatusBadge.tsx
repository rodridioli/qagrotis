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
    "Planejada":    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
    "Em andamento": "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
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

type ResultadoTipo = "Sucesso" | "Erro" | "Pendente"

function ResultadoBadge({ resultado }: { resultado: ResultadoTipo }) {
  const styles: Record<ResultadoTipo, string> = {
    Sucesso:  "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
    Erro:     "border-red-500/30 bg-red-500/10 text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400",
    Pendente: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  }
  return badge(styles[resultado], resultado)
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
