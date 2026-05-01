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
    "Man./Auto.":   "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text",
  }
  return badge(styles[tipo] ?? "border-border-default bg-neutral-grey-50 text-text-secondary", tipo)
}

function SuiteSituacaoBadge({ situacao }: { situacao: SuiteSituacao }) {
  const styles: Record<SuiteSituacao, string> = {
    "Planejada":    "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    "Em andamento": "border-badge-orange/30 bg-badge-orange/10 text-badge-orange-text",
    "Concluída":    "border-badge-success/30 bg-badge-success/10 text-badge-success-text",
  }
  return badge(styles[situacao], situacao)
}

function SuiteTipoBadge({ tipo }: { tipo: SuiteTipo }) {
  const styles: Record<SuiteTipo, string> = {
    "Sprint": "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    "Kanban": "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    "Outro":  "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text",
  }
  return badge(styles[tipo] ?? "border-border-default bg-neutral-grey-50 text-text-secondary", tipo)
}

function AutomacaoBadge({ pct }: { pct: number }) {
  const colorClass =
    pct === 100 ? "border-badge-success/30 bg-badge-success/10 text-badge-success-text" :
    pct > 0     ? "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text" :
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
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-badge-success/30 bg-badge-success/10 text-badge-success-text"
  return badge(colorClass, priority)
}

function ChangelogTagBadge({ tag }: { tag: string }) {
  const styles: Record<string, string> = {
    "Novidade": "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    "Melhoria": "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    "Correção": "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text",
  }
  const colorClass = styles[tag] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, tag)
}

/** Situação da avaliação individual — mesmo padrão visual de {@link SuiteSituacaoBadge}. */
type AvaliacaoSituacaoUi = "Rascunho" | "Concluída"

function AvaliacaoSituacaoBadge({ situacao }: { situacao: AvaliacaoSituacaoUi }) {
  const styles: Record<AvaliacaoSituacaoUi, string> = {
    Rascunho:  "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    Concluída: "border-badge-success/30 bg-badge-success/10 text-badge-success-text",
  }
  return badge(styles[situacao], situacao)
}

/** Período (trimestre/semestre) — pill neutra, alinhada às suítes (sem `rounded-4xl` do Badge UI). */
function AvaliacaoPeriodoBadge({ label }: { label: string }) {
  return badge(
    "border-border-default bg-neutral-grey-50 text-text-secondary dark:border-neutral-grey-700 dark:bg-neutral-grey-900/50 dark:text-neutral-grey-200",
    label,
  )
}

function StatusBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={cn(BASE, colorClass)}>{label}</span>
}

type ResultadoTipo = "Sucesso" | "Erro" | "Pendente" | "Alerta"

function ResultadoBadge({ resultado }: { resultado: ResultadoTipo | string }) {
  const styles: Record<string, string> = {
    Sucesso:  "border-badge-success/30 bg-badge-success/10 text-badge-success-text",
    Erro:     "border-destructive/30 bg-destructive/10 text-destructive",
    Pendente: "border-badge-orange/35 bg-badge-orange/10 text-badge-orange-text",
    Alerta:   "border-alert/55 bg-alert/20 text-alert-foreground",
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
  AvaliacaoSituacaoBadge,
  AvaliacaoPeriodoBadge,
}
export type { CenarioTipo, SuiteTipo, SuiteSituacao, ChangelogTag, ResultadoTipo, AvaliacaoSituacaoUi }
