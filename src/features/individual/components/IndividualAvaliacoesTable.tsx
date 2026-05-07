"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronUp, Eye, FileDown, MoreVertical, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { AvaliacaoPeriodoBadge, AvaliacaoSituacaoBadge } from "@/components/shared/StatusBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import type { IndividualPerformanceEvaluationListRow } from "@/features/individual/actions/individual-performance-evaluations"
import {
  avaliacaoListDisplayPercent,
  evaluationDisplayCodigo,
  evaluationPeriodLabel,
  scorePercentToneClass,
} from "@/features/individual/lib/individual-performance-evaluation"
import { cn } from "@/core/utils"

export interface IndividualAvaliacoesTableProps {
  rows: IndividualPerformanceEvaluationListRow[]
  /** Total de avaliações carregadas (antes do filtro de busca). */
  listTotalCount?: number
  /** Total após o filtro de busca (pode ser 0 com listTotalCount > 0). */
  filteredTotalCount?: number
  /** Administrador+MGR: cartão com total + caixa interior (padrão listas). */
  useMgrListEmptyChrome?: boolean
  /** Administrador+MGR: tendência vs avaliação anterior (lista por código desc). */
  scoreTrendByRowId?: Record<string, "up" | "down" | "same">
  onEdit: (row: IndividualPerformanceEvaluationListRow) => void
  onRequestDelete: (row: IndividualPerformanceEvaluationListRow) => void
  /** Exportar (rótulo curto, sem “PDF” no menu). */
  onExport?: (row: IndividualPerformanceEvaluationListRow) => void
  footer?: ReactNode
  /** Quando true, não renderiza o card wrapper — o pai é responsável pelo container. */
  noWrapper?: boolean
  /** Quando true, oculta a opção “Excluir” do dropdown (usuário avaliado visualizando as próprias avaliações). */
  readOnly?: boolean
}

function AvaliacoesListEmptyChrome({
  totalLabelCount,
  innerMessage,
}: {
  totalLabelCount: number
  innerMessage: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
      <div className="flex h-16 items-center border-b border-border-default px-5">
        <span className="text-sm font-medium text-text-primary">
          Total de avaliações:{" "}
          <span className="font-bold">{totalLabelCount.toLocaleString("pt-BR")}</span>
        </span>
      </div>
      <EmptyState message={innerMessage} />
    </div>
  )
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

export function IndividualAvaliacoesTable({
  rows,
  listTotalCount: listTotalCountProp,
  filteredTotalCount: filteredTotalCountProp,
  useMgrListEmptyChrome = false,
  scoreTrendByRowId,
  onEdit,
  onRequestDelete,
  onExport,
  footer,
  noWrapper = false,
  readOnly = false,
}: IndividualAvaliacoesTableProps) {
  const listTotal = listTotalCountProp ?? rows.length
  const filteredTotal = filteredTotalCountProp ?? rows.length

  if (!noWrapper) {
    if (filteredTotal === 0) {
      if (listTotal === 0 && useMgrListEmptyChrome) {
        return (
          <AvaliacoesListEmptyChrome totalLabelCount={0} innerMessage="Nenhum registro encontrado." />
        )
      }
      if (listTotal === 0) {
        return (
          <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card py-16 shadow-card">
            <p className="text-sm text-text-secondary">Nenhuma avaliação cadastrada para este usuário.</p>
          </div>
        )
      }
      if (useMgrListEmptyChrome) {
        return (
          <AvaliacoesListEmptyChrome
            totalLabelCount={listTotal}
            innerMessage="Nenhum resultado para a busca."
          />
        )
      }
      return (
        <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card py-16 shadow-card">
          <p className="text-sm text-text-secondary">Nenhum resultado para a busca.</p>
        </div>
      )
    }

    if (rows.length === 0) {
      return (
        <div className="flex min-h-36 items-center justify-center rounded-xl border border-border-default bg-surface-card px-4 py-10 text-sm text-text-secondary shadow-card">
          Nenhum registro nesta página.
        </div>
      )
    }
  }

  if (rows.length === 0) return null

  const tableBody = (
    <>
      <div className="overflow-x-auto">
        <table className="qagrotis-table-row-hover-muted w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-border-default bg-neutral-grey-50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Código</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Data</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Período</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Pontuação</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Situação</th>
              <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border-default last:border-b-0 transition-colors">
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className="cursor-pointer font-semibold text-brand-primary tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                    aria-label={`Abrir avaliação ${evaluationDisplayCodigo(r.codigo)}`}
                  >
                    {evaluationDisplayCodigo(r.codigo)}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                  {formatDataPt(r.dataYmd)}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <AvaliacaoPeriodoBadge label={evaluationPeriodLabel(r.periodo)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                  {(() => {
                    const displayPct = avaliacaoListDisplayPercent(r.pontuacaoPercent)
                    const trend = scoreTrendByRowId?.[r.id]
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn("text-sm font-semibold tabular-nums", scorePercentToneClass(displayPct))}
                        >
                          {displayPct.toFixed(0).replace(".", ",")}%
                        </span>
                        {trend === "up" ? (
                          <ChevronUp
                            className="size-4 shrink-0 text-green-600 dark:text-green-400"
                            aria-label="Pontuação superior à avaliação anterior"
                          />
                        ) : null}
                        {trend === "down" ? (
                          <ChevronDown
                            className="size-4 shrink-0 text-red-600 dark:text-red-400"
                            aria-label="Pontuação inferior à avaliação anterior"
                          />
                        ) : null}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <AvaliacaoSituacaoBadge situacao={r.status === "CONCLUIDA" ? "Concluída" : "Rascunho"} />
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
                      <DropdownMenuItem onClick={() => onEdit(r)}>
                        {r.status === "CONCLUIDA" ? (
                          <Eye className="size-4" />
                        ) : (
                          <Pencil className="size-4" />
                        )}
                        {r.status === "CONCLUIDA" ? "Visualizar" : "Editar"}
                      </DropdownMenuItem>
                      {onExport ? (
                        <DropdownMenuItem onClick={() => onExport(r)}>
                          <FileDown className="size-4" />
                          Exportar
                        </DropdownMenuItem>
                      ) : null}
                      {!readOnly ? (
                        <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(r)}>
                          <Trash2 className="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
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
