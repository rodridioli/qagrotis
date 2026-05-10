"use client"

import type { ReactNode } from "react"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ProgressaoTipoBadge, ProgressaoRegimeBadge } from "@/components/shared/StatusBadge"
import {
  progressaoDisplayCodigo,
  formatValorBRL,
  type ProgressaoListRow,
} from "@/features/individual/lib/individual-progressao"

export interface IndividualProgressaoTableProps {
  rows: ProgressaoListRow[]
  onEdit?: (row: ProgressaoListRow) => void
  onRequestDelete?: (row: ProgressaoListRow) => void
  footer?: ReactNode
  readOnly?: boolean
  valoresVisiveis?: boolean
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

export function IndividualProgressaoTable({
  rows,
  onEdit,
  onRequestDelete,
  footer,
  readOnly = false,
  valoresVisiveis = false,
}: IndividualProgressaoTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="qagrotis-table-row-hover-muted w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-default bg-neutral-grey-50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Código
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Data
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Tipo
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Regime
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">
                Cargo
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-text-secondary sm:px-4">
                Valor
              </th>
              {!readOnly ? (
                <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">
                  <span className="sr-only">Ações</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border-default last:border-b-0 transition-colors">
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                  {!readOnly && onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="cursor-pointer font-semibold tabular-nums text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                      aria-label={`Abrir progressão ${progressaoDisplayCodigo(r.codigo)}`}
                    >
                      {progressaoDisplayCodigo(r.codigo)}
                    </button>
                  ) : (
                    <span className="font-semibold tabular-nums text-text-primary">
                      {progressaoDisplayCodigo(r.codigo)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                  {formatDataPt(r.dataYmd)}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <ProgressaoTipoBadge tipo={r.tipo} />
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <ProgressaoRegimeBadge regime={r.regime} />
                </td>
                <td className="px-3 py-3 text-text-primary sm:px-4">
                  {r.cargo || <span className="text-text-disabled">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-primary sm:px-4">
                  {valoresVisiveis ? formatValorBRL(r.valor) : "R$ •••••••"}
                </td>
                {!readOnly ? (
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
                        <DropdownMenuItem onClick={() => onEdit?.(r)}>
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete?.(r)}>
                          <Trash2 className="size-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  )
}
