"use client"

import * as React from "react"
import { ChevronDown, Pencil, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { OkrProgressBar } from "@/features/okrs/components/OkrProgressBar"
import { OkrSituacaoBadge } from "@/features/okrs/components/OkrSituacaoBadge"
import { OkrKeyResultCard } from "@/features/okrs/components/OkrKeyResultCard"
import { OkrObjetivoFormModal } from "@/features/okrs/components/OkrObjetivoFormModal"
import { OkrKeyResultFormModal } from "@/features/okrs/components/OkrKeyResultFormModal"
import { OkrCancelModal } from "@/features/okrs/components/OkrCancelModal"
import { EmptyState } from "@/components/shared/EmptyState"
import { EQUIPE_LABELS, type OkrObjetivoDto, type OkrPeriodoDto } from "@/features/okrs/lib/okrs-schemas"
import {
  updateOkrObjetivo,
  cancelOkrObjetivo,
  createOkrKeyResult,
  getMembrosByEquipes,
  type OkrEquipeMembro,
} from "@/features/okrs/actions/okrs"
import { cn } from "@/core/utils"

interface OkrObjetivoAccordionProps {
  objetivo: OkrObjetivoDto
  periodo: OkrPeriodoDto
  canEditObjetivo: boolean
  canEditKr: boolean
  canUpdateValue: boolean
  canManageIniciativas: boolean
  canUpdateIniciativaStatus: boolean
  currentUserId: string
  okrEncerrado: boolean
  onRefresh: () => void
  defaultOpen?: boolean
}

export function OkrObjetivoAccordion({
  objetivo,
  periodo,
  canEditObjetivo,
  canEditKr,
  canUpdateValue,
  canManageIniciativas,
  canUpdateIniciativaStatus,
  currentUserId,
  okrEncerrado,
  onRefresh,
  defaultOpen = false,
}: OkrObjetivoAccordionProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [editOpen, setEditOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [krFormOpen, setKrFormOpen] = React.useState(false)
  const [membros, setMembros] = React.useState<OkrEquipeMembro[]>([])
  const [saving, setSaving] = React.useState(false)

  const isCanceled = objetivo.situacao === "CANCELADO"

  async function loadMembros() {
    if (objetivo.equipes.length === 0) return
    const res = await getMembrosByEquipes(objetivo.equipes)
    if ("data" in res) setMembros(res.data)
  }

  async function handleEditSubmit(data: { descricao: string; equipes: typeof objetivo.equipes }) {
    setSaving(true)
    try {
      const res = await updateOkrObjetivo(objetivo.id, data)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Objetivo atualizado.")
      setEditOpen(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(motivo: string) {
    setSaving(true)
    try {
      const res = await cancelOkrObjetivo(objetivo.id, { motivoCancelamento: motivo })
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Objetivo cancelado.")
      setCancelOpen(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateKr(data: Parameters<typeof createOkrKeyResult>[1]) {
    setSaving(true)
    try {
      const res = await createOkrKeyResult(objetivo.id, data)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Key Result criado.")
      setKrFormOpen(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const activeKrs = objetivo.keyResults.filter((kr) => kr.situacao === "ATIVO")

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card transition-opacity",
        isCanceled && "opacity-70",
      )}
    >
      {/* Header do accordion */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors",
          open ? "bg-muted/20" : "hover:bg-muted/40",
        )}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn("size-4 shrink-0 text-text-secondary transition-transform duration-200", open && "rotate-180")}
        />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-semibold text-text-primary", isCanceled && "line-through")}>
              {objetivo.descricao}
            </span>
            <OkrSituacaoBadge situacao={objetivo.situacao} />
            {objetivo.equipes.map((e) => (
              <span key={e} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {EQUIPE_LABELS[e]}
              </span>
            ))}
          </div>
          {!isCanceled && (
            <OkrProgressBar value={objetivo.percentualConcluido} max={100} showLabel />
          )}
          {isCanceled && objetivo.motivoCancelamento && (
            <p className="text-xs text-text-secondary">
              <span className="font-medium">Motivo:</span> {objetivo.motivoCancelamento}
            </p>
          )}
        </div>

        {canEditObjetivo && !okrEncerrado && !isCanceled && (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label="Editar objetivo"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCancelOpen(true)}
              aria-label="Cancelar objetivo"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        <span className="ml-2 shrink-0 text-xs tabular-nums text-text-secondary">
          {activeKrs.length} KR{activeKrs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Conteúdo */}
      {open && (
        <div className="border-t border-border-default px-4 py-4 space-y-3">
          {objetivo.keyResults.length === 0 ? (
            <EmptyState message="Nenhum Key Result. Adicione o primeiro." />
          ) : (
            <div className="space-y-3">
              {objetivo.keyResults.map((kr) => (
                <OkrKeyResultCard
                  key={kr.id}
                  kr={kr}
                  equipes={objetivo.equipes}
                  periodo={periodo}
                  canEditKr={canEditKr && !isCanceled}
                  canUpdateValue={canUpdateValue}
                  canManageIniciativas={canManageIniciativas && !isCanceled}
                  canUpdateIniciativaStatus={canUpdateIniciativaStatus}
                  currentUserId={currentUserId}
                  okrEncerrado={okrEncerrado}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}

          {canEditKr && !isCanceled && !okrEncerrado && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadMembros(); setKrFormOpen(true) }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Key Result
            </Button>
          )}
        </div>
      )}

      {/* Modais */}
      <OkrObjetivoFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
        loading={saving}
        initial={objetivo}
      />
      <OkrCancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        titulo="Cancelar Objetivo"
        descricao={objetivo.descricao}
        loading={saving}
      />
      <OkrKeyResultFormModal
        open={krFormOpen}
        onClose={() => setKrFormOpen(false)}
        onSubmit={handleCreateKr}
        loading={saving}
        membros={membros}
      />
    </div>
  )
}
