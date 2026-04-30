"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClipboardPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { IndividualAvaliacoesTable } from "@/components/individual/IndividualAvaliacoesTable"
import {
  createDraftIndividualPerformanceEvaluation,
  deleteIndividualPerformanceEvaluation,
  listIndividualPerformanceEvaluations,
  type IndividualPerformanceEvaluationListRow,
} from "@/lib/actions/individual-performance-evaluations"

export interface IndividualAvaliacoesSectionProps {
  evaluatedUserId: string
}

export function IndividualAvaliacoesSection({ evaluatedUserId }: IndividualAvaliacoesSectionProps) {
  const router = useRouter()
  const [rows, setRows] = React.useState<IndividualPerformanceEvaluationListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<IndividualPerformanceEvaluationListRow | null>(null)

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

  async function onAdd() {
    setCreating(true)
    try {
      const res = await createDraftIndividualPerformanceEvaluation(evaluatedUserId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      router.push(
        `/individual/avaliacao/${encodeURIComponent(res.id)}?userId=${encodeURIComponent(evaluatedUserId)}`,
      )
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível criar a avaliação.")
    } finally {
      setCreating(false)
    }
  }

  function onEdit(row: IndividualPerformanceEvaluationListRow) {
    router.push(
      `/individual/avaliacao/${encodeURIComponent(row.id)}?userId=${encodeURIComponent(evaluatedUserId)}`,
    )
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
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary sm:text-lg">Avaliações de desempenho</h2>
          <p className="text-sm text-text-secondary">Registre e acompanhe avaliações deste colaborador.</p>
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2"
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
          rows={rows}
          onEdit={onEdit}
          onRequestDelete={(row) => {
            setDeleteRow(row)
            setDeleteOpen(true)
          }}
        />
      )}

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
