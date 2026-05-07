"use client"

import React from "react"
import { UserAvatar, cargoLabel } from "@/components/equipe/EquipePerformanceCard"

export interface EquipeAniversarioCardProps {
  name: string
  classificacao: string | null
  photoPath: string | null
  /** Texto já formatado para exibição (ex.: dd/mm/aaaa) */
  dataNascimentoLabel: string
}

/**
 * Card alinhado ao cabeçalho visual do {@link EquipePerformanceCard} (foto, nome, cargo).
 */
export function EquipeAniversarioCard({
  name,
  classificacao,
  photoPath,
  dataNascimentoLabel,
}: EquipeAniversarioCardProps) {
  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card"
      aria-label={`Aniversário de ${name}`}
    >
      <div className="border-b border-border-default px-4 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <UserAvatar name={name} photoPath={photoPath} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight text-text-primary">{name}</p>
            <p className="mt-0.5 truncate text-sm text-text-secondary">{cargoLabel(classificacao)}</p>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 px-4 py-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          Data de nascimento
        </span>
        <p className="text-base font-semibold tabular-nums text-text-primary sm:text-lg">
          {dataNascimentoLabel}
        </p>
      </div>
    </article>
  )
}
