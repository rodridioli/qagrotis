"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { UserPerformanceData } from "@/lib/actions/equipe"

const FALLBACK_ROW_LABELS = ["Gerencial", "Plataforma", "SAP-B1"] as const

export function UserAvatar({ name, photoPath, size }: { name: string; photoPath: string | null; size: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
  const cls = "flex-shrink-0 rounded-full object-cover ring-2 ring-border-default"
  if (photoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoPath}
        alt={name}
        className={cls}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={cn(
        cls,
        "flex items-center justify-center bg-neutral-grey-100 text-sm font-semibold text-text-primary",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </div>
  )
}

/** Badge 1º–4º lugar + ponto de cor (referência visual) */
function RankLugarBadge({ rank }: { rank: number }) {
  const label = `${rank}º Lugar`
  const { wrap, dot } =
    rank === 1
      ? {
          wrap:
            "border-2 border-amber-500/70 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-400/60 dark:bg-amber-950/50 dark:text-amber-50",
          dot: "bg-amber-500 dark:bg-amber-400",
        }
      : rank === 2
        ? {
            wrap:
              "border-secondary-300 bg-secondary-100 text-secondary-900 dark:border-secondary-600 dark:bg-secondary-800/60 dark:text-secondary-50",
            dot: "bg-neutral-grey-500 dark:bg-neutral-grey-400",
          }
        : rank === 3
          ? {
              wrap:
                "border-orange-400/45 bg-orange-100 text-orange-950 dark:border-orange-500/35 dark:bg-orange-950/45 dark:text-orange-50",
              dot: "bg-orange-500 dark:bg-orange-400",
            }
          : {
              wrap:
                "border-border-default bg-neutral-grey-100 text-text-secondary dark:bg-neutral-grey-800 dark:text-neutral-grey-100",
              dot: "bg-neutral-grey-400 dark:bg-neutral-grey-500",
            }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
        wrap,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  )
}

/** Caixa única: número em destaque + rótulo em caixa alta (referência) */
function StatBox({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: "cenarios" | "testes" | "success" | "error" | "info"
}) {
  const surface = cn(
    "flex w-full min-w-0 flex-col items-center justify-center rounded-lg px-1 py-2 sm:px-1.5 sm:py-2.5",
    variant === "cenarios" &&
      "bg-neutral-grey-100 dark:bg-neutral-grey-200",
    variant === "testes" && "bg-secondary-100 dark:bg-secondary-800/50",
    variant === "success" && "bg-primary-50 dark:bg-primary-950/45",
    variant === "error" && "bg-red-100 dark:bg-red-950/40",
    variant === "info" && "bg-blue-100 dark:bg-blue-950/45",
  )
  const numCls = cn(
    "text-base font-bold tabular-nums sm:text-lg",
    variant === "cenarios" && "text-text-primary",
    variant === "testes" && "text-secondary-800 dark:text-secondary-100",
    variant === "success" && "text-primary-800 dark:text-primary-200",
    variant === "error" && "text-destructive dark:text-red-300",
    variant === "info" && "text-blue-800 dark:text-blue-200",
  )
  return (
    <div className={surface}>
      <span className={numCls}>{value}</span>
      <span className="mt-0.5 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-text-secondary">
        {label}
      </span>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-grey-100 dark:bg-neutral-grey-200">
      <div
        className="h-full rounded-full bg-brand-primary transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

export function cargoLabel(classificacao: string | null): string {
  const c = (classificacao ?? "").trim()
  if (c) return c
  return "Colaborador"
}

export interface EquipePerformanceCardProps {
  user: UserPerformanceData
  rank: number
}

type CardLabels = {
  cenarios: string
  testes: string
  sucesso: string
  erros?: string         // omitido = não renderiza o box "Erros"
  automatizados?: string // omitido = não renderiza a barra de automatizados
}

const LABELS_BY_PROFILE: Record<string, CardLabels> = {
  UX: {
    cenarios: "Protótipos",
    testes: "Pesquisas",
    sucesso: "Validações",
    erros: "Usabilidade",
    automatizados: "Taxa de Retorno",
  },
  TW: {
    cenarios: "Novos",
    testes: "Revisões",
    sucesso: "Outros",
  },
}

const DEFAULT_LABELS: CardLabels = {
  cenarios: "Cenários",
  testes: "Testes",
  sucesso: "Sucesso",
  erros: "Erros",
  automatizados: "Automatizados",
}

export function EquipePerformanceCard({ user, rank }: EquipePerformanceCardProps) {
  const labels = LABELS_BY_PROFILE[user.accessProfile ?? ""] ?? DEFAULT_LABELS
  const errosVariant: "error" | "info" = user.accessProfile === "UX" ? "info" : "error"
  const hasAnySistema = user.atividadePorSistema.length > 0
  const detailRowsResolved = useMemo(() => {
    if (!hasAnySistema) {
      return FALLBACK_ROW_LABELS.map((label) => ({ label, value: "—" }))
    }
    const src = user.atividadePorSistema
    return [0, 1, 2].map((i) => {
      const row = src[i]
      const label = row?.sistema?.trim() || FALLBACK_ROW_LABELS[i]
      const value = row?.modulos?.length ? row.modulos.join(", ") : "—"
      return { label, value }
    })
  }, [hasAnySistema, user.atividadePorSistema])

  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card"
      aria-label={`Resumo de performance de ${user.name}`}
    >
      <div className="relative border-b border-border-default px-4 pb-3 pt-4">
        <div className="flex items-start gap-3 pr-[7.5rem] sm:pr-28">
          <UserAvatar name={user.name} photoPath={user.photoPath} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight text-text-primary">{user.name}</p>
            <p className="mt-0.5 truncate text-sm text-text-secondary">{cargoLabel(user.classificacao)}</p>
          </div>
        </div>
        <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
          <RankLugarBadge rank={rank} />
        </div>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        {detailRowsResolved.map((row, rowIdx) => (
          <div
            key={`perf-detail-${rowIdx}-${row.label}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
          >
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-text-secondary sm:text-xs">
              {row.label}
            </span>
            <span className="min-w-0 text-right font-semibold text-text-primary">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Métricas: 4 colunas (com Erros) ou 3 colunas (sem Erros). */}
      <div
        className={cn(
          "grid gap-1.5 border-t border-border-default px-3 py-3 sm:gap-2 sm:px-4 sm:py-4",
          labels.erros ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        <StatBox label={labels.cenarios} value={user.cenariosCriados} variant="cenarios" />
        <StatBox label={labels.testes} value={user.testesExecutados} variant="testes" />
        <StatBox label={labels.sucesso} value={user.sucessos} variant="success" />
        {labels.erros && (
          <StatBox label={labels.erros} value={user.errosEncontrados} variant={errosVariant} />
        )}
      </div>

      {labels.automatizados && (
      <div className="border-t border-border-default px-4 pb-4 pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
            {labels.automatizados}
          </span>
          <span className="text-xs font-semibold tabular-nums text-text-primary sm:text-sm">
            {user.testesAutomatizados} de {user.cenariosCriados} - {user.percentualAutomatizado}%
          </span>
        </div>
        <ProgressBar value={user.percentualAutomatizado} />
      </div>
      )}
    </article>
  )
}
