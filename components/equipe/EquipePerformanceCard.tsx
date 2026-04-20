"use client"

import React from "react"
import { cn } from "@/lib/utils"
import type { UserPerformanceData } from "@/lib/actions/equipe"

// ── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({
  name,
  photoPath,
  size,
  ringClass,
}: {
  name: string
  photoPath: string | null
  size: number
  ringClass?: string
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
  const cls = cn(
    "flex-shrink-0 rounded-2xl object-cover ring-2 ring-white",
    ringClass,
  )
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
      className={cn(cls, "flex items-center justify-center bg-white/20 font-semibold text-white")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </div>
  )
}

// ── Stat box (valor em “caixa”, como na referência visual) ─────────────────

function StatBox({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: "neutral" | "success" | "error"
}) {
  const box = cn(
    "flex min-h-10 w-full max-w-[5rem] items-center justify-center rounded-lg px-2 py-1.5 text-lg font-bold tabular-nums sm:max-w-none",
    variant === "neutral" &&
      "bg-neutral-grey-100 text-text-primary dark:bg-neutral-grey-200 dark:text-text-primary",
    variant === "success" &&
      "bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300",
    variant === "error" &&
      "bg-red-100 text-destructive dark:bg-red-950/40 dark:text-red-300",
  )
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <div className={box}>{value}</div>
      <span className="text-center text-[11px] leading-tight text-text-secondary">
        {label}
      </span>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-grey-100 dark:bg-neutral-grey-200">
      <div
        className="h-full rounded-full bg-brand-primary transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────

export interface EquipePerformanceCardProps {
  user: UserPerformanceData
  /** Ordem de exibição (1 = Prioridade 1) */
  rank: number
}

export function EquipePerformanceCard({ user, rank }: EquipePerformanceCardProps) {
  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card"
      aria-label={`Resumo de performance de ${user.name}`}
    >
      {/* Cabeçalho verde: foto + nome + cargo + prioridade */}
      <div className="bg-brand-primary px-4 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <UserAvatar name={user.name} photoPath={user.photoPath} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight text-white">
              {user.name}
            </p>
            <p className="mt-1 truncate text-sm text-white/90">
              {user.classificacao ? (
                <span>{user.classificacao}</span>
              ) : (
                <span className="italic text-white/70">Sem classificação</span>
              )}
            </p>
            <span
              className={cn(
                "mt-2 inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold",
                "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
              )}
            >
              Prioridade {rank}
            </span>
          </div>
        </div>
      </div>

      {/* Sistemas / módulos — uma linha por sistema */}
      <div className="border-b border-border-default px-4 py-3">
        {user.atividadePorSistema.length > 0 ? (
          <div className="space-y-1.5">
            {user.atividadePorSistema.map(({ sistema, modulos }) => (
              <p key={sistema} className="text-sm leading-snug text-text-primary">
                <span className="font-medium">{sistema}:</span>{" "}
                <span className="font-semibold">
                  {modulos.length > 0 ? modulos.join(", ") : "—"}
                </span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-text-secondary">
            Nenhum sistema/módulo no período filtrado.
          </p>
        )}
      </div>

      {/* Métricas em caixas */}
      <div className="grid grid-cols-2 gap-3 px-3 py-4 sm:grid-cols-4 sm:gap-2 sm:px-4">
        <StatBox label="Cenários" value={user.cenariosCriados} variant="neutral" />
        <StatBox label="Testes" value={user.testesExecutados} variant="neutral" />
        <StatBox label="Sucesso" value={user.sucessos} variant="success" />
        <StatBox label="Erros" value={user.errosEncontrados} variant="error" />
      </div>

      {/* Automatizados — bloco com borda verde */}
      <div className="mx-3 mb-4 mt-0 rounded-lg border-2 border-primary-200 bg-primary-50/60 p-3 dark:border-primary-700 dark:bg-primary-950/25 sm:mx-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-primary">
            Automatizados
          </span>
          <span className="text-sm font-bold tabular-nums text-text-primary">
            {user.testesAutomatizados} de {user.cenariosCriados}
          </span>
        </div>
        <ProgressBar value={user.percentualAutomatizado} />
        <div className="mt-1.5 flex justify-end">
          <span className="text-sm font-bold text-brand-primary dark:text-primary-400">
            {user.percentualAutomatizado}%
          </span>
        </div>
      </div>
    </article>
  )
}
