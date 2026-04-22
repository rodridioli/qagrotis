"use client"

import React from "react"
import { UserAvatar, cargoLabel } from "@/components/equipe/EquipePerformanceCard"
import type { EquipeUsuarioCadastro } from "@/lib/actions/equipe"

export interface EquipeHorariosTableProps {
  rows: EquipeUsuarioCadastro[]
}

/**
 * Tabela mobile-first: rolagem horizontal em telas estreitas; ordem das linhas definida no servidor.
 */
export function EquipeHorariosTable({ rows }: EquipeHorariosTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card py-16 shadow-card">
        <p className="text-sm text-text-secondary">
          Nenhum usuário com horário de entrada e saída preenchidos.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[280px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900/40">
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Nome
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Cargo
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Horário Entrada
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Horário Saída
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.userId}
              className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/80 dark:hover:bg-neutral-grey-900/25"
            >
              <td className="px-3 py-3 sm:px-4">
                <div className="flex min-w-0 max-w-[14rem] items-center gap-2.5 sm:max-w-none">
                  <UserAvatar name={u.name} photoPath={u.photoPath} size={36} />
                  <span className="min-w-0 truncate font-medium text-text-primary">{u.name}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-text-secondary sm:px-4">
                <span className="line-clamp-2">{cargoLabel(u.classificacao)}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                {u.horarioEntrada}
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                {u.horarioSaida}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
