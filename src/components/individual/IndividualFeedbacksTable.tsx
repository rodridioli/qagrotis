"use client"

import type { ReactNode } from "react"
import { Eye, FileDown, MoreVertical, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { AvaliacaoSituacaoBadge, FeedbackTipoBadge } from "@/components/qagrotis/StatusBadge"
import { EmptyState } from "@/components/qagrotis/EmptyState"
import {
  feedbackDisplayCodigo,
  feedbackTipoLabel,
  type IndividualFeedbackListRow,
} from "@/lib/individual-feedback"
import { evaluationPeriodLabel } from "@/lib/individual-performance-evaluation"

export interface IndividualFeedbacksTableProps {
  rows: IndividualFeedbackListRow[]
  onEdit: (row: IndividualFeedbackListRow) => void
  onRequestDelete: (row: IndividualFeedbackListRow) => void
  onExport?: (row: IndividualFeedbackListRow) => void
  footer?: ReactNode
  /** Quando true, não renderiza o card wrapper — o pai é responsável pelo container. */
  noWrapper?: boolean
  /** Quando true, oculta Editar e Excluir (usuário avaliado visualizando os próprios feedbacks). */
  readOnly?: boolean
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

export function IndividualFeedbacksTable({
  rows,
  onEdit,
  onRequestDelete,
  onExport,
  footer,
  noWrapper = false,
  readOnly = false,
}: IndividualFeedbacksTableProps) {
  if (!noWrapper && rows.length === 0) return null

  const tableBody = (
    <>
      <div className="overflow-x-auto">
        <table className="qagrotis-table-row-hover-muted w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-border-default bg-neutral-grey-50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Código
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Data
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Tipo de Feedback
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Período
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Situação
              </th>
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
                    aria-label={`Abrir feedback ${feedbackDisplayCodigo(r.codigo)}`}
                  >
                    {feedbackDisplayCodigo(r.codigo)}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                  {formatDataPt(r.dataYmd)}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <FeedbackTipoBadge tipo={r.tipo} label={feedbackTipoLabel(r.tipo)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary sm:px-4">
                  {evaluationPeriodLabel(r.periodo)}
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
                        {!readOnly && r.status !== "CONCLUIDA" ? (
                          <Pencil className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                        {!readOnly && r.status !== "CONCLUIDA" ? "Editar" : "Visualizar"}
                      </DropdownMenuItem>
                      {!readOnly ? (
                        <>
                          {onExport ? (
                            <DropdownMenuItem onClick={() => onExport(r)}>
                              <FileDown className="size-4" />
                              Exportar
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(r)}>
                            <Trash2 className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </>
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

export function IndividualFeedbacksEmptyState({ message }: { message: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
      <EmptyState message={message} />
    </div>
  )
}
