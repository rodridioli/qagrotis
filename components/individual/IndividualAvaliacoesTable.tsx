"use client"

import type { ReactNode } from "react"
import { FileDown, MoreVertical, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { AvaliacaoPeriodoBadge, AvaliacaoSituacaoBadge } from "@/components/qagrotis/StatusBadge"
import type { IndividualPerformanceEvaluationListRow } from "@/lib/actions/individual-performance-evaluations"
import {
  evaluationPeriodLabel,
  formatIndividualEvaluationCodigo,
  scorePercentToneClass,
} from "@/lib/individual-performance-evaluation"
import { cn } from "@/lib/utils"

export interface IndividualAvaliacoesTableProps {
  rows: IndividualPerformanceEvaluationListRow[]
  onEdit: (row: IndividualPerformanceEvaluationListRow) => void
  onRequestDelete: (row: IndividualPerformanceEvaluationListRow) => void
  onExportPdf?: (row: IndividualPerformanceEvaluationListRow) => void
  footer?: ReactNode
  /** Sem card externo (uso com `TableToolbar` no mesmo `rounded-xl`, como em /cenarios). */
  embedded?: boolean
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

export function IndividualAvaliacoesTable({
  rows,
  onEdit,
  onRequestDelete,
  onExportPdf,
  footer,
  embedded = false,
}: IndividualAvaliacoesTableProps) {
  if (rows.length === 0) {
    if (embedded) return null
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card py-16 shadow-card">
        <p className="text-sm text-text-secondary">Nenhuma avaliação cadastrada para este usuário.</p>
      </div>
    )
  }

  const tableBlock = (
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
                    aria-label={`Abrir avaliação ${formatIndividualEvaluationCodigo(r.codigo)}`}
                  >
                    {formatIndividualEvaluationCodigo(r.codigo)}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                  {formatDataPt(r.dataYmd)}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <AvaliacaoPeriodoBadge label={evaluationPeriodLabel(r.periodo)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                  {r.pontuacaoPercent != null ? (
                    <span className={cn("text-sm font-semibold tabular-nums", scorePercentToneClass(r.pontuacaoPercent))}>
                      {r.pontuacaoPercent.toFixed(1).replace(".", ",")}%
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
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
                        <Pencil className="size-4" />
                        {r.status === "CONCLUIDA" ? "Ver / editar" : "Editar"}
                      </DropdownMenuItem>
                      {onExportPdf ? (
                        <DropdownMenuItem
                          onClick={() => {
                            onExportPdf(r)
                          }}
                        >
                          <FileDown className="size-4" />
                          Exportar PDF
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(r)}>
                        <Trash2 className="size-4" />
                        Remover
                      </DropdownMenuItem>
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

  if (embedded) {
    return tableBlock
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
      {tableBlock}
    </div>
  )
}
