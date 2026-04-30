"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { IndividualAvaliacoesTable } from "@/components/individual/IndividualAvaliacoesTable"
import {
  deleteIndividualPerformanceEvaluation,
  getIndividualPerformanceEvaluation,
  listIndividualPerformanceEvaluations,
  type IndividualPerformanceEvaluationListRow,
} from "@/lib/actions/individual-performance-evaluations"
import { downloadIndividualEvaluationPdf } from "@/lib/individual-performance-evaluation-pdf"

const AVALIACOES_PAGE_SIZE = 20

export interface IndividualAvaliacoesSectionProps {
  evaluatedUserId: string
  evaluatedDisplayName: string
  evaluatedEmail?: string
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
  evaluatedDisplayName,
  evaluatedEmail,
}: IndividualAvaliacoesSectionProps) {
  const router = useRouter()
  const [isNavigating, startTransition] = React.useTransition()
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

  const userQ = `?userId=${encodeURIComponent(evaluatedUserId)}`

  function onAdd() {
    startTransition(() => {
      router.push(`/individual/avaliacoes/nova${userQ}`)
    })
  }

  function onEdit(row: IndividualPerformanceEvaluationListRow) {
    startTransition(() => {
      router.push(`/individual/avaliacoes/${row.id}${userQ}`)
    })
  }

  async function onExportPdf(row: IndividualPerformanceEvaluationListRow) {
    try {
      const detail = await getIndividualPerformanceEvaluation(row.id)
      if (!detail || detail.evaluatedUserId !== evaluatedUserId) {
        toast.error("Não foi possível carregar a avaliação para exportar.")
        return
      }
      downloadIndividualEvaluationPdf({
        detail,
        evaluatedName: evaluatedDisplayName,
        evaluatedEmail: evaluatedEmail ?? null,
        dataExibicaoYmd: row.dataYmd,
      })
      toast.success("PDF transferido.")
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível gerar o PDF.")
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return
    const res = await deleteIndividualPerformanceEvaluation(deleteRow.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Avaliação removida.")
    setDeleteOpen(false)
    setDeleteRow(null)
    void refetch()
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" className="gap-2" onClick={onAdd} disabled={loading || isNavigating}>
          <Plus className="size-4" aria-hidden />
          {isNavigating ? "A abrir…" : "Adicionar Avaliação"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
        {!loading ? (
          <TableToolbar
            search={q}
            onSearchChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            searchPlaceholder="Buscar por data…"
            totalLabel="Total de avaliações"
            totalCount={filtered.length}
            baseCount={rows.length}
          />
        ) : null}

        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center py-12">
            <p className="text-sm text-text-secondary">Carregando…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma avaliação cadastrada para este usuário.
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhum registro encontrado.
          </div>
        ) : (
          <IndividualAvaliacoesTable
            embedded
            rows={paginated}
            onEdit={onEdit}
            onExportPdf={onExportPdf}
            onRequestDelete={(row) => {
              setDeleteRow(row)
              setDeleteOpen(true)
            }}
            footer={
              filtered.length > AVALIACOES_PAGE_SIZE ? (
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
        title="Remover avaliação?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
