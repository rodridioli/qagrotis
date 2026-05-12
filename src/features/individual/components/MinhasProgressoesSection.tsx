"use client"

import * as React from "react"
import { EmptyState } from "@/components/shared/EmptyState"
import { TablePagination } from "@/components/shared/TablePagination"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { IndividualProgressaoTable } from "@/features/individual/components/IndividualProgressaoTable"
import { listMinhasProgressoes } from "@/features/individual/actions/individual-progressao"
import type { ProgressaoListRow } from "@/features/individual/lib/individual-progressao"

const PAGE_SIZE = 20

export function MinhasProgressoesSection() {
  const [rows, setRows] = React.useState<ProgressaoListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listMinhasProgressoes())
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar as progressões.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <div className="flex items-center border-b border-border-default bg-neutral-grey-50/50 px-4 py-3">
          <span className="text-sm text-text-secondary">
            {loading ? "—" : `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}
          </span>
        </div>

        {error ? (
          <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
            <button
              type="button"
              onClick={() => void refetch()}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {loading ? (
          <SectionSpinner />
        ) : rows.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <IndividualProgressaoTable
            rows={paginated}
            readOnly
            footer={
              totalPages > 1 ? (
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={rows.length}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setPage}
                />
              ) : null
            }
          />
        )}
      </div>
    </div>
  )
}
