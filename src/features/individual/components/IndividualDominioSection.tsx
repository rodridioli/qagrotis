"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { TablePagination } from "@/components/shared/TablePagination"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { IndividualDominioTable } from "@/features/individual/components/IndividualDominioTable"
import { DominioVisualizarSheet } from "@/features/individual/components/DominioVisualizarSheet"
import {
  listDominioAvaliacoes,
  deleteDominioAvaliacao,
  type DominioAvaliacaoListRow,
} from "@/features/individual/actions/individual-dominio"

const PAGE_SIZE = 20

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

export interface IndividualDominioSectionProps {
  evaluatedUserId: string
  /** Quando true, oculta o botão de excluir (usuário sem permissão MGR). */
  readOnly?: boolean
}

export function IndividualDominioSection({
  evaluatedUserId,
  readOnly = false,
}: IndividualDominioSectionProps) {
  const [rows, setRows] = React.useState<DominioAvaliacaoListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<DominioAvaliacaoListRow | null>(null)
  const [viewOpen, setViewOpen] = React.useState(false)
  const [viewId, setViewId] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listDominioAvaliacoes(evaluatedUserId)
      setRows(list)
    } catch (e) {
      console.error("[IndividualDominioSection]", e)
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar as avaliações.")
    } finally {
      setLoading(false)
    }
  }, [evaluatedUserId])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const filtered = React.useMemo(
    () => rows.filter((r) => matchesDateSearch(r.dataYmd, q)),
    [rows, q],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  React.useEffect(() => {
    setPage(1)
  }, [q, evaluatedUserId])

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  /** Tendência vs avaliação imediatamente anterior (lista ordenada por codigo desc). */
  const scoreTrendByRowId = React.useMemo(() => {
    const m: Record<string, "up" | "down" | "same"> = {}
    const concluded = filtered.filter((r) => r.status === "CONCLUIDA")
    for (let i = 0; i < concluded.length; i++) {
      const cur = concluded[i]!
      const older = concluded[i + 1]
      if (!older) continue
      const curPct = cur.resultadoPercent ?? 0
      const prevPct = older.resultadoPercent ?? 0
      m[cur.id] = curPct > prevPct ? "up" : curPct < prevPct ? "down" : "same"
    }
    return m
  }, [filtered])

  async function confirmDelete() {
    if (!deleteRow) return
    const res = await deleteDominioAvaliacao(deleteRow.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Avaliação de domínio removida.")
    setDeleteOpen(false)
    setDeleteRow(null)
    void refetch()
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={q}
          onSearchChange={(v) => {
            setQ(v)
            setPage(1)
          }}
          searchPlaceholder="Buscar por data…"
          totalLabel="Total de avaliações"
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
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <IndividualDominioTable
            rows={paginated}
            scoreTrendByRowId={scoreTrendByRowId}
            onView={(row) => {
              setViewId(row.id)
              setViewOpen(true)
            }}
            onRequestDelete={
              readOnly
                ? undefined
                : (row) => {
                    setDeleteRow(row)
                    setDeleteOpen(true)
                  }
            }
            noWrapper
            footer={
              totalPages > 1 ? (
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setPage}
                />
              ) : null
            }
          />
        )}
      </div>

      <DominioVisualizarSheet
        open={viewOpen}
        onOpenChange={setViewOpen}
        avaliacaoId={viewId}
      />

      {!readOnly ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Excluir avaliação de domínio?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          confirmIcon={<Trash2 className="size-4 shrink-0" aria-hidden />}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  )
}
