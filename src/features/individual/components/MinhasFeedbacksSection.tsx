"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/EmptyState"
import { TablePagination } from "@/components/shared/TablePagination"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { IndividualFeedbacksTable } from "@/features/individual/components/IndividualFeedbacksTable"
import { listMyCompletedFeedbacks } from "@/features/individual/actions/individual-feedbacks"
import type { IndividualFeedbackListRow } from "@/features/individual/lib/individual-feedback"
import { SectionSpinner } from "@/components/shared/SectionSpinner"

const FEEDBACKS_PAGE_SIZE = 20

function matchesDateSearch(dataYmd: string, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  const [y, m, d] = dataYmd.split("-")
  if (!y || !m || !d) return dataYmd.toLowerCase().includes(t)
  const pt = `${d}/${m}/${y}`
  const digitsQ = t.replace(/\D/g, "")
  const digitsYmd = dataYmd.replace(/\D/g, "")
  const digitsPt = pt.replace(/\D/g, "")
  return (
    dataYmd.toLowerCase().includes(t) ||
    pt.toLowerCase().includes(t) ||
    (digitsQ.length > 0 && (digitsYmd.includes(digitsQ) || digitsPt.includes(digitsQ)))
  )
}

export function MinhasFeedbacksSection({ showCompletedToast = false }: { showCompletedToast?: boolean }) {
  const router = useRouter()
  const [, startTransition] = React.useTransition()
  const [rows, setRows] = React.useState<IndividualFeedbackListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    if (!showCompletedToast) return
    toast.success("Feedback concluído.")
    const url = new URL(window.location.href)
    url.searchParams.delete("completed")
    window.history.replaceState({}, "", url.toString())
  }, [showCompletedToast])

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listMyCompletedFeedbacks()
      setRows(list)
    } catch (e) {
      console.error("[MinhasFeedbacksSection]", e)
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar os feedbacks.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const filtered = React.useMemo(
    () => rows.filter((r) => matchesDateSearch(r.dataYmd, q)),
    [rows, q],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / FEEDBACKS_PAGE_SIZE))

  React.useEffect(() => {
    setPage(1)
  }, [q])

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * FEEDBACKS_PAGE_SIZE
    return filtered.slice(start, start + FEEDBACKS_PAGE_SIZE)
  }, [filtered, page])

  function onView(row: IndividualFeedbackListRow) {
    startTransition(() => {
      router.push(`/individual/meus-feedbacks/${row.id}`)
    })
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1) }}
          searchPlaceholder="Buscar por data…"
          totalLabel="Total de feedbacks"
          totalCount={loading ? 0 : filtered.length}
          baseCount={loading ? 0 : rows.length}
        />

        {error ? (
          <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <SectionSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={
              rows.length === 0
                ? "Nenhum feedback recebido."
                : "Nenhum resultado para a busca."
            }
          />
        ) : (
          <IndividualFeedbacksTable
            rows={paginated}
            onEdit={onView}
            onRequestDelete={() => {}}
            readOnly
            noWrapper
            footer={
              totalPages > 1 ? (
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  itemsPerPage={FEEDBACKS_PAGE_SIZE}
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
