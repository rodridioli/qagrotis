"use client"

import * as React from "react"
import { CalendarPlus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EquipeChaptersTable } from "@/components/equipe/EquipeChaptersTable"
import {
  ChapterScheduleDialog,
  type ChapterScheduleInitial,
} from "@/components/equipe/ChapterScheduleDialog"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { EquipeChapterRanking } from "@/components/equipe/EquipeChapterRanking"
import {
  listEquipeChapters,
  listEquipeChapterAuthorOptions,
  deleteEquipeChapter,
  getEquipeChapterAuthorRankingPage,
} from "@/lib/actions/equipe-chapters"
import {
  EQUIPE_CHAPTERS_TABLE_PAGE_SIZE,
  type EquipeChapterAuthorOption,
  type EquipeChapterListRow,
  type EquipeChapterRankingPage,
} from "@/lib/equipe-chapters-shared"
import { TablePagination } from "@/components/qagrotis/TablePagination"

export interface EquipeChaptersSectionProps {
  isAdmin: boolean
}

export function EquipeChaptersSection({ isAdmin }: EquipeChaptersSectionProps) {
  const [rows, setRows] = React.useState<EquipeChapterListRow[]>([])
  const [rankingData, setRankingData] = React.useState<EquipeChapterRankingPage | null>(null)
  const [rankingBusy, setRankingBusy] = React.useState(false)
  const [authorOptions, setAuthorOptions] = React.useState<EquipeChapterAuthorOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")

  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [scheduleMode, setScheduleMode] = React.useState<"create" | "edit">("create")
  const [editInitial, setEditInitial] = React.useState<ChapterScheduleInitial | null>(null)

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<EquipeChapterListRow | null>(null)

  const [chaptersPage, setChaptersPage] = React.useState(1)

  const loadRankingPage = React.useCallback(async (page: number) => {
    setRankingBusy(true)
    try {
      const rank = await getEquipeChapterAuthorRankingPage(page)
      setRankingData(rank)
    } catch (e) {
      console.error("[EquipeChaptersSection] ranking página", e)
    } finally {
      setRankingBusy(false)
    }
  }, [])

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, rank] = await Promise.all([
        listEquipeChapters(),
        getEquipeChapterAuthorRankingPage(1),
      ])
      setRows(list)
      setRankingData(rank)
    } catch {
      setRows([])
      setRankingData(null)
      setError("Não foi possível carregar os chapters. Tente novamente em instantes.")
    }
    try {
      const opts = await listEquipeChapterAuthorOptions()
      setAuthorOptions(Array.isArray(opts) ? opts : [])
    } catch (e) {
      console.error("[EquipeChaptersSection] listEquipeChapterAuthorOptions", e)
      setAuthorOptions([])
      toast.error("Não foi possível carregar a lista de autores. Atualize a página ou tente de novo.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  /** Ao abrir o modal, busca de novo os usuários ativos (evita lista vazia por corrida com o 1º load). */
  React.useEffect(() => {
    if (!scheduleOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const opts = await listEquipeChapterAuthorOptions()
        if (!cancelled) setAuthorOptions(Array.isArray(opts) ? opts : [])
      } catch (e) {
        console.error("[EquipeChaptersSection] autores ao abrir modal", e)
        if (!cancelled) {
          toast.error("Não foi possível carregar os autores. Verifique se você está logado.")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scheduleOpen])

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(
      (r) =>
        r.tema.toLowerCase().includes(t) ||
        r.autoresLabel.toLowerCase().includes(t),
    )
  }, [rows, q])

  const chaptersTotalPages = Math.max(1, Math.ceil(filtered.length / EQUIPE_CHAPTERS_TABLE_PAGE_SIZE))

  React.useEffect(() => {
    setChaptersPage(1)
  }, [q])

  React.useEffect(() => {
    setChaptersPage((p) => Math.min(p, chaptersTotalPages))
  }, [chaptersTotalPages])

  const paginatedChapters = React.useMemo(() => {
    const start = (chaptersPage - 1) * EQUIPE_CHAPTERS_TABLE_PAGE_SIZE
    return filtered.slice(start, start + EQUIPE_CHAPTERS_TABLE_PAGE_SIZE)
  }, [filtered, chaptersPage])

  function openCreate() {
    setScheduleMode("create")
    setEditInitial(null)
    setScheduleOpen(true)
  }

  function openEdit(row: EquipeChapterListRow) {
    setScheduleMode("edit")
    setEditInitial({
      id: row.id,
      tema: row.tema,
      dataYmd: row.dataYmd,
      authorIds: [...row.authorIds],
      hyperlink: row.hyperlink,
    })
    setScheduleOpen(true)
  }

  function requestDelete(row: EquipeChapterListRow) {
    setDeleteRow(row)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleteRow) return
    const res = await deleteEquipeChapter(deleteRow.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Chapter removido.")
    setDeleteOpen(false)
    setDeleteRow(null)
    await refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por tema ou autor…"
            className="pl-9"
            aria-label="Buscar chapters por tema ou autor"
          />
        </div>
        <Button
          type="button"
          onClick={openCreate}
          disabled={loading}
          className="w-full shrink-0 sm:w-auto"
        >
          <CalendarPlus className="size-4" />
          Agendar Chapter
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
          <p className="text-center text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_minmax(16rem,22rem)] xl:items-start">
          <div className="min-w-0">
            <EquipeChaptersTable
              rows={paginatedChapters}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onRequestDelete={requestDelete}
              footer={
                filtered.length > EQUIPE_CHAPTERS_TABLE_PAGE_SIZE ? (
                  <TablePagination
                    currentPage={chaptersPage}
                    totalPages={chaptersTotalPages}
                    totalItems={filtered.length}
                    itemsPerPage={EQUIPE_CHAPTERS_TABLE_PAGE_SIZE}
                    onPageChange={setChaptersPage}
                  />
                ) : null
              }
            />
          </div>
          <EquipeChapterRanking
            data={rankingData}
            loading={rankingBusy}
            onPageChange={(p) => void loadRankingPage(p)}
            className="min-w-0 xl:sticky xl:top-4"
          />
        </div>
      )}

      <ChapterScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        mode={scheduleMode}
        initial={editInitial}
        authorOptions={authorOptions}
        onSuccess={() => void refetch()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remover chapter"
        description={
          deleteRow
            ? `Tem certeza que deseja remover o chapter "${deleteRow.tema.slice(0, 80)}${deleteRow.tema.length > 80 ? "…" : ""}"? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Remover"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
