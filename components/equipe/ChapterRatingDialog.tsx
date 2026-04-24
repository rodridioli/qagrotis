"use client"

import * as React from "react"
import { Pencil, Star } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AutoResizeTextarea } from "@/components/qagrotis/AutoResizeTextarea"
import { listChapterRatings, createChapterRating } from "@/lib/actions/equipe-chapters"
import type { EquipeChapterRatingEntry } from "@/lib/equipe-chapters-shared"
import { ChapterStarsSummary } from "@/components/equipe/ChapterStarsSummary"
import { cn } from "@/lib/utils"

function formatPt(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

export interface ChapterRatingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapterId: string
  tema: string
  /** Só Storybook: quando definido, não chama o servidor e usa estas entradas. */
  previewEntries?: EquipeChapterRatingEntry[]
  onSubmitted?: () => void | Promise<void>
}

export function ChapterRatingDialog({
  open,
  onOpenChange,
  chapterId,
  tema,
  previewEntries,
  onSubmitted,
}: ChapterRatingDialogProps) {
  const [entries, setEntries] = React.useState<EquipeChapterRatingEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [view, setView] = React.useState<"overview" | "form">("overview")
  const [starsPick, setStarsPick] = React.useState(0)
  const [comment, setComment] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const myEntry = React.useMemo(() => entries.find((e) => e.isMine), [entries])

  const reload = React.useCallback(async () => {
    if (!chapterId) return
    if (previewEntries !== undefined) {
      setEntries(previewEntries)
      return
    }
    setLoading(true)
    try {
      const list = await listChapterRatings(chapterId)
      setEntries(list)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [chapterId, previewEntries])

  React.useEffect(() => {
    if (!open || !chapterId) return
    void reload()
  }, [open, chapterId, reload])

  React.useEffect(() => {
    if (!open) {
      setView("overview")
      setStarsPick(0)
      setComment("")
    }
  }, [open])

  const avg =
    entries.length > 0 ? entries.reduce((s, e) => s + e.stars, 0) / entries.length : null
  const dist = React.useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0] as number[]
    for (const e of entries) {
      const k = Math.min(5, Math.max(0, e.stars))
      c[k] += 1
    }
    return c
  }, [entries])
  const maxBar = Math.max(1, ...dist)

  function openFormNew() {
    setStarsPick(0)
    setComment("")
    setView("form")
  }

  function openFormEdit() {
    const mine = entries.find((e) => e.isMine)
    if (mine) {
      setStarsPick(mine.stars)
      setComment(mine.comment)
    }
    setView("form")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chapterId) return
    if (previewEntries !== undefined) return
    setSaving(true)
    try {
      const res = await createChapterRating({ chapterId, stars: starsPick, comment })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Avaliação guardada.")
      await reload()
      await onSubmitted?.()
      setView("overview")
    } catch {
      toast.error("Não foi possível guardar.")
    } finally {
      setSaving(false)
    }
  }

  const isPreview = previewEntries !== undefined
  const showAvaliarCta = !myEntry

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left leading-snug">Avaliações — {tema}</DialogTitle>
        </DialogHeader>

        {view === "overview" ? (
          <>
            <div className="grid gap-4 border-b border-border-default pb-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Distribuição
                </p>
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1, 0].map((n) => (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-3 shrink-0 tabular-nums text-text-secondary">{n}</span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-grey-100">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${(dist[n] / maxBar) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-center gap-2 rounded-lg border border-border-default bg-neutral-grey-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Resumo
                </p>
                {loading && entries.length === 0 ? (
                  <p className="text-sm text-text-secondary">A carregar…</p>
                ) : (
                  <>
                    <span className="text-3xl font-bold tabular-nums text-text-primary">
                      {avg != null ? avg.toFixed(1).replace(".", ",") : "—"}
                    </span>
                    <ChapterStarsSummary avg={avg} count={entries.length} />
                  </>
                )}
              </div>
            </div>

            {showAvaliarCta ? (
              <div className="flex flex-col gap-3 border-b border-border-default pb-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-secondary">
                  Partilhe a sua nota e comentário quando quiser.
                </p>
                <Button
                  type="button"
                  className="shrink-0"
                  disabled={isPreview}
                  title={isPreview ? "Pré-visualização sem servidor." : undefined}
                  onClick={openFormNew}
                >
                  Avaliar
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Histórico (autores anónimos)
              </p>
              {entries.length === 0 ? (
                <p className="text-sm text-text-secondary">Ainda não há avaliações.</p>
              ) : (
                <ul className="max-h-56 space-y-3 overflow-y-auto pr-1">
                  {entries.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-text-primary">Anónimo</span>
                        <time className="text-xs text-text-secondary tabular-nums" dateTime={e.createdAt}>
                          {formatPt(e.createdAt)}
                        </time>
                      </div>
                      <div className="mt-1 flex gap-0.5" aria-label={`${e.stars} estrelas`}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={cn(
                              "size-3.5",
                              i <= e.stars ? "fill-amber-400 text-amber-500" : "text-neutral-grey-300",
                            )}
                            strokeWidth={1.4}
                          />
                        ))}
                      </div>
                      {e.comment.trim() ? (
                        <div className="mt-2 flex gap-2">
                          <p className="min-w-0 flex-1 whitespace-pre-wrap text-text-primary">{e.comment.trim()}</p>
                          {e.isMine ? (
                            <button
                              type="button"
                              className="shrink-0 self-start rounded-md p-1 text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                              aria-label="Editar comentário"
                              title="Editar comentário"
                              disabled={isPreview}
                              onClick={openFormEdit}
                            >
                              <Pencil className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      ) : e.isMine ? (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                            disabled={isPreview}
                            onClick={openFormEdit}
                          >
                            <Pencil className="size-3.5" />
                            Editar avaliação
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="border-b border-border-default pb-3 text-sm font-medium text-text-primary">A sua avaliação</p>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Número de estrelas de 0 a 5">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStarsPick(n)}
                  className={cn(
                    "min-w-10 rounded-md border px-2 py-1.5 text-sm font-medium transition-colors",
                    starsPick === n
                      ? "border-brand-primary bg-primary-100 text-brand-primary"
                      : "border-border-default bg-surface-card text-text-primary hover:bg-neutral-grey-50",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 pt-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-5",
                    i <= starsPick ? "fill-amber-400 text-amber-500" : "text-neutral-grey-300",
                  )}
                  strokeWidth={1.4}
                />
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Comentário (opcional)</label>
              <AutoResizeTextarea
                value={comment}
                onChange={(ev) => setComment(ev.target.value)}
                placeholder="Escreva um comentário…"
                className="min-h-[80px] text-sm"
                maxLength={2000}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setView("overview")}>
                Voltar
              </Button>
              <Button type="submit" disabled={saving || isPreview} title={isPreview ? "Pré-visualização sem servidor." : undefined}>
                {saving ? "A guardar…" : myEntry ? "Guardar alterações" : "Enviar avaliação"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
