import * as React from "react"
import { cn } from "@/core/utils"

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

function AccessProfileBadge({ perfil }: { perfil: string | null | undefined }) {
  if (!perfil) return <span className="text-text-secondary">—</span>
  const styles: Record<string, string> = {
    QA:  "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    UX:  "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    TW:  "border-badge-warning/40 bg-badge-warning/10 text-badge-warning-text",
    MGR: "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
  }
  const colorClass = styles[perfil] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, perfil)
}

function JiraPriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority?.trim()) return <span className="text-text-secondary">—</span>
  const norm = priority.trim().normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase()
  let colorClass: string
  if (
    norm === "critical" || norm === "critico" || norm === "critica" ||
    norm === "highest" || norm === "blocker" || norm === "imediato" ||
    norm.includes("critical") || norm.includes("critica") || norm.includes("critico")
  ) {
    colorClass = "border-destructive/30 bg-destructive/10 text-destructive"
  } else if (norm === "high" || norm === "alta" || norm.includes("alta") || norm.includes("high")) {
    colorClass = "border-badge-warning/40 bg-badge-warning/10 text-badge-warning-text"
  } else if (norm === "medium" || norm === "media" || norm === "média" || norm.includes("medium") || norm.includes("media")) {
    colorClass = "border-badge-info/30 bg-badge-info/10 text-badge-info-text"
  } else if (
    norm === "low" || norm === "lowest" || norm === "baixa" || norm === "minor" ||
    norm.includes("baixa") || norm.includes("low")
  ) {
    colorClass = "border-badge-success/30 bg-badge-success/10 text-badge-success-text"
  } else {
    colorClass = "border-secondary-500/30 bg-secondary-500/10 text-secondary-600"
  }
  return badge(colorClass, priority.trim())
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

/** Tipo de feedback — cor por categoria semântica. */
function FeedbackTipoBadge({ tipo, label }: { tipo: string; label: string }) {
  const styles: Record<string, string> = {
    POSITIVO:           "border-badge-success/30 bg-badge-success/10 text-badge-success-text",
    DESENVOLVIMENTO:    "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    CORRETIVO:          "border-destructive/30 bg-destructive/10 text-destructive",
    FORMAL_CICLO:       "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    TREZENTOS_SESSENTA: "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
  }
  const colorClass = styles[tipo] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, label)
}

/** Período (trimestre/semestre) — pill neutra, alinhada às suítes (sem `rounded-4xl` do Badge UI). */
function AvaliacaoPeriodoBadge({ label }: { label: string }) {
  return badge(
    "border-border-default bg-neutral-grey-50 text-text-secondary",
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

function ProgressaoTipoBadge({ tipo }: { tipo: string }) {
  const styles: Record<string, string> = {
    ADMISSAO:     "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    DISSIDIO:     "border-badge-warning/40 bg-badge-warning/10 text-badge-warning-text",
    PROMOCAO:     "border-badge-success/30 bg-badge-success/10 text-badge-success-text",
    MERITO:       "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    DESLIGAMENTO: "border-destructive/30 bg-destructive/10 text-destructive",
  }
  const labels: Record<string, string> = {
    ADMISSAO:     "Admissão",
    DISSIDIO:     "Dissídio",
    PROMOCAO:     "Promoção",
    MERITO:       "Mérito",
    DESLIGAMENTO: "Desligamento",
  }
  const colorClass = styles[tipo] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, labels[tipo] ?? tipo)
}

function ProgressaoRegimeBadge({ regime }: { regime: string }) {
  const styles: Record<string, string> = {
    CLT:        "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    PJ:         "border-badge-orange/35 bg-badge-orange/10 text-badge-orange-text",
    COOPERADO:  "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    ESTAGIARIO: "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    TRAINEE:    "border-badge-purple/30 bg-badge-purple/10 text-badge-purple-text",
  }
  const labels: Record<string, string> = {
    CLT:        "CLT",
    PJ:         "PJ",
    COOPERADO:  "Cooperado",
    ESTAGIARIO: "Estagiário",
    TRAINEE:    "Trainee",
  }
  const colorClass = styles[regime] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return badge(colorClass, labels[regime] ?? regime)
}

type FeriasSituacao = "planejada" | "em_andamento" | "concluida"

function FeriasSituacaoBadge({ situacao }: { situacao: FeriasSituacao }) {
  const styles: Record<FeriasSituacao, string> = {
    planejada:    "border-badge-info/30 bg-badge-info/10 text-badge-info-text",
    em_andamento: "border-badge-orange/30 bg-badge-orange/10 text-badge-orange-text",
    concluida:    "border-border-default bg-neutral-grey-50 text-text-secondary",
  }
  const labels: Record<FeriasSituacao, string> = {
    planejada:    "Planejada",
    em_andamento: "Em andamento",
    concluida:    "Concluída",
  }
  return badge(styles[situacao], labels[situacao])
}

// ── Ausências ────────────────────────────────────────────────────────────────

type AusenciaSituacao = "PENDENTE" | "APROVADA" | "RECUSADA"
type AusenciaTipo = "FALTA" | "BANCO_HORAS" | "ATESTADO" | "ATRASO" | "OUTRO"

function AusenciaSituacaoBadge({
  situacao,
  onClick,
}: {
  situacao: AusenciaSituacao
  onClick?: () => void
}) {
  const styles: Record<AusenciaSituacao, string> = {
    PENDENTE: "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text",
    APROVADA: "border-badge-success/30 bg-badge-success/10 text-badge-success-text",
    RECUSADA: "border-destructive/30 bg-destructive/10 text-destructive",
  }
  const labels: Record<AusenciaSituacao, string> = {
    PENDENTE: "Pendente",
    APROVADA: "Aprovada",
    RECUSADA: "Recusada",
  }
  const isClickable = onClick != null && situacao === "RECUSADA"
  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Ver motivo da recusa"
        className={cn(BASE, styles[situacao], "cursor-pointer transition-opacity hover:opacity-80")}
      >
        {labels[situacao]}
      </button>
    )
  }
  return <span className={cn(BASE, styles[situacao])}>{labels[situacao]}</span>
}

function AusenciaTipoBadge({ tipo }: { tipo: AusenciaTipo }) {
  const styles: Record<AusenciaTipo, string> = {
    FALTA:       "border-destructive/30 bg-destructive/10 text-destructive",
    BANCO_HORAS: "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    ATESTADO:    "border-badge-warning/30 bg-badge-warning/10 text-badge-warning-text",
    ATRASO:      "border-orange-400/30 bg-orange-400/10 text-orange-600",
    OUTRO:       "border-border-default bg-neutral-grey-50 text-text-secondary",
  }
  const labels: Record<AusenciaTipo, string> = {
    FALTA:       "Falta",
    BANCO_HORAS: "Banco de horas",
    ATESTADO:    "Atestado",
    ATRASO:      "Atraso",
    OUTRO:       "Outro",
  }
  return badge(styles[tipo], labels[tipo])
}

export {
  StatusBadge,
  ResultadoBadge,
  CenarioTipoBadge,
  SuiteTipoBadge,
  SuiteSituacaoBadge,
  AutomacaoBadge,
  UserTipoBadge,
  AccessProfileBadge,
  PriorityBadge,
  JiraPriorityBadge,
  ChangelogTagBadge,
  AvaliacaoSituacaoBadge,
  AvaliacaoPeriodoBadge,
  FeedbackTipoBadge,
  ProgressaoTipoBadge,
  ProgressaoRegimeBadge,
  FeriasSituacaoBadge,
  AusenciaSituacaoBadge,
  AusenciaTipoBadge,
}
export type { CenarioTipo, SuiteTipo, SuiteSituacao, ChangelogTag, ResultadoTipo, AvaliacaoSituacaoUi, FeriasSituacao, AusenciaSituacao, AusenciaTipo }
