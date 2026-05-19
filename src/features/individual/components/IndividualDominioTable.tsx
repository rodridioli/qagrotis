"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronUp, Eye, MoreVertical, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/EmptyState"
import type { DominioAvaliacaoListRow } from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

export interface IndividualDominioTableProps {
  rows: DominioAvaliacaoListRow[]
  /** Tendência vs avaliação anterior (lista ordenada por codigo desc). */
  scoreTrendByRowId?: Record<string, "up" | "down" | "same">
  onView: (row: DominioAvaliacaoListRow) => void
  onRequestDelete?: (row: DominioAvaliacaoListRow) => void
  footer?: ReactNode
  noWrapper?: boolean
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function dominioCodigoPadded(codigo: number): string {
  return `DOM-${String(codigo).padStart(3, "0")}`
}

function resultadoToneClass(pct: number): string {
  if (pct >= 80) return "text-green-600 dark:text-green-400"
  if (pct >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

export function IndividualDominioTable({
  rows,
  scoreTrendByRowId,
  onView,
  onRequestDelete,
  footer,
  noWrapper = false,
}: IndividualDominioTableProps) {
  if (rows.length === 0) {
    if (noWrapper) return null
    return (
      <div className="rounded-xl border border-border-default bg-surface-card shadow-card">
        <EmptyState message="Nenhum registro encontrado." />
      </div>
    )
  }

  const tableBody = (
    <>
      <div className="overflow-x-auto">
        <table className="qagrotis-table-row-hover-muted w-full min-w-[280px] text-sm">
          <thead>
            <tr className="border-b border-border-default bg-neutral-grey-50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Código
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Data
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Resultado
              </th>
              <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.resultadoPercent ?? 0
              const trend = scoreTrendByRowId?.[r.id]

              return (
                <tr
                  key={r.id}
                  className="border-b border-border-default last:border-b-0 transition-colors"
                >
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => onView(r)}
                      className="cursor-pointer font-semibold text-brand-primary tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                      aria-label={`Ver avaliação ${dominioCodigoPadded(r.codigo)}`}
                    >
                      {dominioCodigoPadded(r.codigo)}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                    {formatDataPt(r.dataYmd)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    {r.status === "PENDENTE" ? (
                      <span className="text-sm text-text-secondary italic">Pendente</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            resultadoToneClass(pct),
                          )}
                        >
                          {pct.toFixed(0)}%
                        </span>
                        {trend === "up" ? (
                          <ChevronUp
                            className="size-4 shrink-0 text-green-600 dark:text-green-400"
                            aria-label="Resultado superior ao anterior"
                          />
                        ) : trend === "down" ? (
                          <ChevronDown
                            className="size-4 shrink-0 text-red-600 dark:text-red-400"
                            aria-label="Resultado inferior ao anterior"
                          />
                        ) : trend === "same" ? (
                          <span
                            className="text-sm font-semibold text-text-secondary"
                            aria-label="Mesmo resultado que o anterior"
                          >
                            –
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center sm:px-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Mais ações"
                            className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem onClick={() => onView(r)}>
                          <Eye className="size-4" />
                          Visualizar
                        </DropdownMenuItem>
                        {onRequestDelete ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onRequestDelete(r)}
                          >
                            <Trash2 className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  )

  if (noWrapper) return tableBody

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
      {tableBody}
    </div>
  )
}
