"use client"

import * as React from "react"
import { ClipboardPlus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { IndividualAvaliacoesTable } from "@/components/individual/IndividualAvaliacoesTable"
import {
  IndividualPerformanceEvaluationModal,
  type EvaluatedUserSummary,
} from "@/components/individual/IndividualPerformanceEvaluationModal"
import {
  createDraftIndividualPerformanceEvaluation,
  deleteIndividualPerformanceEvaluation,
  listIndividualPerformanceEvaluations,
  type IndividualPerformanceEvaluationListRow,
} from "@/lib/actions/individual-performance-evaluations"

const AVALIACOES_PAGE_SIZE = 20

export interface IndividualAvaliacoesSectionProps {
  evaluatedUserId: string
  evaluatedUser: EvaluatedUserSummary
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

export function IndividualAvaliacoesSection({ evaluatedUserId, evaluatedUser }: IndividualAvaliacoesSectionProps) {
  const [rows, setRows] = React.useState<IndividualPerformanceEvaluationListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<IndividualPerformanceEvaluationListRow | null>(null)
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [modalEvalId, setModalEvalId] = React.useState<string | null>(null)

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

  async function onAdd() {
    setCreating(true)
    try {
      const res = await createDraftIndividualPerformanceEvaluation(evaluatedUserId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setModalEvalId(res.id)
      setModalOpen(true)
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível criar a avaliação.")
    } finally {
      setCreating(false)
    }
  }

  function onEdit(row: IndividualPerformanceEvaluationListRow) {
    setModalEvalId(row.id)
    setModalOpen(true)
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

  function handleModalOpenChange(open: boolean) {
    setModalOpen(open)
    if (!open) setModalEvalId(null)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por data…"
            className="pl-9"
            aria-label="Buscar avaliações por data"
          />
        </div>
        <Button
          type="button"
          className="w-full shrink-0 gap-2 sm:w-auto"
          onClick={() => void onAdd()}
          disabled={creating || loading}
        >
          <ClipboardPlus className="size-4" aria-hidden />
          {creating ? "A criar…" : "Adicionar Avaliação"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-border-default bg-surface-card py-12 shadow-card">
          <p className="text-sm text-text-secondary">Carregando…</p>
        </div>
      ) : (
        <IndividualAvaliacoesTable
          rows={paginated}
          onEdit={onEdit}
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

      <IndividualPerformanceEvaluationModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        evaluationId={modalEvalId}
        evaluatedUserId={evaluatedUserId}
        evaluatedUser={evaluatedUser}
        onSaved={() => void refetch()}
      />

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
