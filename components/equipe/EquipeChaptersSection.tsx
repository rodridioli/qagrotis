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
import {
  listEquipeChapters,
  listEquipeChapterAuthorOptions,
  deleteEquipeChapter,
  type EquipeChapterAuthorOption,
  type EquipeChapterListRow,
} from "@/lib/actions/equipe-chapters"

export interface EquipeChaptersSectionProps {
  isAdmin: boolean
}

export function EquipeChaptersSection({ isAdmin }: EquipeChaptersSectionProps) {
  const [rows, setRows] = React.useState<EquipeChapterListRow[]>([])
  const [authorOptions, setAuthorOptions] = React.useState<EquipeChapterAuthorOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")

  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [scheduleMode, setScheduleMode] = React.useState<"create" | "edit">("create")
  const [editInitial, setEditInitial] = React.useState<ChapterScheduleInitial | null>(null)

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<EquipeChapterListRow | null>(null)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, opts] = await Promise.all([listEquipeChapters(), listEquipeChapterAuthorOptions()])
      setRows(list)
      setAuthorOptions(opts)
    } catch {
      setRows([])
      setAuthorOptions([])
      setError("Não foi possível carregar os chapters. Tente novamente em instantes.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(
      (r) =>
        r.tema.toLowerCase().includes(t) ||
        r.autoresLabel.toLowerCase().includes(t),
    )
  }, [rows, q])

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
        <Button type="button" onClick={openCreate} className="w-full shrink-0 sm:w-auto">
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
        <EquipeChaptersTable
          rows={filtered}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onRequestDelete={requestDelete}
        />
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
