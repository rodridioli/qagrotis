"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { TablePagination } from "@/components/shared/TablePagination"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { IndividualAvaliacoesTable } from "@/features/individual/components/IndividualAvaliacoesTable"
import {
  deleteIndividualPerformanceEvaluation,
  listIndividualPerformanceEvaluations,
  type IndividualPerformanceEvaluationListRow,
} from "@/features/individual/actions/individual-performance-evaluations"
import { avaliacaoListDisplayPercent, evaluationDisplayCodigo } from "@/features/individual/lib/individual-performance-evaluation"
import { SectionSpinner } from "@/components/shared/SectionSpinner"

const AVALIACOES_PAGE_SIZE = 20

export interface IndividualAvaliacoesSectionProps {
  evaluatedUserId: string
  /** Administrador + MGR: empty state igual a outras listas (ex.: cenários). */
  useMgrListEmptyChrome?: boolean
  /** Quando true, exibe o toast de "avaliação concluída" ao montar e limpa o param da URL. */
  showCompletedToast?: boolean
}

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

export function IndividualAvaliacoesSection({
  evaluatedUserId,
  useMgrListEmptyChrome = false,
  showCompletedToast = false,
}: IndividualAvaliacoesSectionProps) {
  const router = useRouter()
  const [, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (!showCompletedToast) return
    toast.success("Avaliação concluída.")
    // Remove o param ?completed=1 da URL sem causar navegação
    const url = new URL(window.location.href)
    url.searchParams.delete("completed")
    window.history.replaceState({}, "", url.toString())
  }, [showCompletedToast])
  const [rows, setRows] = React.useState<IndividualPerformanceEvaluationListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<IndividualPerformanceEvaluationListRow | null>(null)
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listIndividualPerformanceEvaluations(evaluatedUserId)
      setRows(list)
    } catch (e) {
      console.error("[IndividualAvaliacoesSection]", e)
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar as avaliações.")
    } finally {
      setLoading(false)
    }
  }, [evaluatedUserId])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const filtered = React.useMemo(() => {
    return rows.filter((r) => matchesDateSearch(r.dataYmd, q))
  }, [rows, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / AVALIACOES_PAGE_SIZE))

  React.useEffect(() => {
    setPage(1)
  }, [q, evaluatedUserId])

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * AVALIACOES_PAGE_SIZE
    return filtered.slice(start, start + AVALIACOES_PAGE_SIZE)
  }, [filtered, page])

  /** Tendência vs avaliação mais antiga imediatamente a seguir na lista (ordenada por código desc). */
  const scoreTrendByRowId = React.useMemo(() => {
    const m: Record<string, "up" | "down" | "same"> = {}
    for (let i = 0; i < filtered.length; i++) {
      const row = filtered[i]!
      const older = filtered[i + 1]
      if (!older) continue
      const cur = avaliacaoListDisplayPercent(row.pontuacaoPercent)
      const prev = avaliacaoListDisplayPercent(older.pontuacaoPercent)
      m[row.id] = cur > prev ? "up" : cur < prev ? "down" : "same"
    }
    return m
  }, [filtered])

  const userQ = `?userId=${encodeURIComponent(evaluatedUserId)}`

  function onEdit(row: IndividualPerformanceEvaluationListRow) {
    startTransition(() => {
      router.push(`/individual/avaliacoes/${row.id}${userQ}`)
    })
  }

  async function confirmDelete() {
    if (!deleteRow) return
    const res = await deleteIndividualPerformanceEvaluation(deleteRow.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Avaliação removida com sucesso.")
    setDeleteOpen(false)
    setDeleteRow(null)
    void refetch()
  }

  if (loading) return <SectionSpinner minHeight="min-h-[60vh]" />

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1) }}
          searchPlaceholder="Buscar por data…"
          totalLabel="Total de avaliações"
          totalCount={filtered.length}
          baseCount={rows.length}
        />

        {error ? (
          <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <IndividualAvaliacoesTable
            rows={paginated}
            scoreTrendByRowId={useMgrListEmptyChrome ? scoreTrendByRowId : undefined}
            onEdit={onEdit}
            onExport={
              useMgrListEmptyChrome
                ? (row) => {
                    void (async () => {
                      try {
                        const res = await fetch(`/api/individual-performance-evaluations/${row.id}/pdf`)
                        if (!res.ok) {
                          toast.error("Não foi possível exportar.")
                          return
                        }
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `avaliacao-${evaluationDisplayCodigo(row.codigo)}.pdf`
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                        toast.success("Exportado com sucesso.")
                      } catch {
                        toast.error("Não foi possível exportar.")
                      }
                    })()
                  }
                : undefined
            }
            onRequestDelete={(row) => {
              setDeleteRow(row)
              setDeleteOpen(true)
            }}
            noWrapper
            footer={
              totalPages > 1 ? (
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  itemsPerPage={AVALIACOES_PAGE_SIZE}
                  onPageChange={setPage}
                />
              ) : null
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir avaliação?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        confirmIcon={<Trash2 className="size-4 shrink-0" aria-hidden />}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
