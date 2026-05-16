"use client"

import React from "react"
import { UserAvatar, cargoLabel } from "@/features/equipe/components/EquipePerformanceCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { TableToolbar } from "@/components/shared/TableToolbar"
import type { EquipeUsuarioCadastro } from "@/features/equipe/actions/equipe"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export interface EquipeHorariosTableProps {
  rows: EquipeUsuarioCadastro[]
}

function FormatoCell({ u }: { u: EquipeUsuarioCadastro }) {
  const fmt = u.formatoTrabalho
  if (fmt === "Híbrido") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="cursor-help border-b border-dashed border-border-default text-left font-medium text-text-primary underline-offset-2 hover:border-brand-primary hover:text-brand-primary"
            >
              {fmt}
            </button>
          }
        />
        <TooltipContent
          side="top"
          className="max-w-[min(20rem,calc(100vw-2rem))] text-left text-xs leading-snug font-normal"
        >
          {u.hybridNaoPresencialTooltip}
        </TooltipContent>
      </Tooltip>
    )
  }
  return <span className="text-text-primary">{fmt}</span>
}

/**
 * Tabela mobile-first: rolagem horizontal em telas estreitas; ordem das linhas definida no servidor.
 */
export function EquipeHorariosTable({ rows }: EquipeHorariosTableProps) {
  const [search, setSearch] = React.useState("")

  if (rows.length === 0) {
    return <EmptyState message="Nenhum usuário com horário de entrada e saída preenchidos." />
  }

  const filtered = search.trim()
    ? rows.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome…"
        totalLabel="Total usuários"
        totalCount={rows.length}
        baseCount={rows.length}
      />
      <div className="overflow-x-auto">
      <table className="qagrotis-table-row-hover-muted w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Nome
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Cargo
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
              Formato
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
          {filtered.map((u) => (
            <tr
              key={u.userId}
              className="border-b border-border-default last:border-b-0 transition-colors"
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
              <td className="min-w-[5.5rem] px-3 py-3 sm:px-4">
                <FormatoCell u={u} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                {u.horarioEntrada}
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                {u.horarioSaida}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                Nenhum usuário encontrado para "{search}".
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
