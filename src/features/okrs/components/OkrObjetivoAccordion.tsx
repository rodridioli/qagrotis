"use client"

import * as React from "react"
import { ChevronDown, MoreVertical, Pencil, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OkrProgressBar } from "@/features/okrs/components/OkrProgressBar"
import { OkrKeyResultCard } from "@/features/okrs/components/OkrKeyResultCard"
import { OkrObjetivoFormModal } from "@/features/okrs/components/OkrObjetivoFormModal"
import { OkrKeyResultFormModal } from "@/features/okrs/components/OkrKeyResultFormModal"
import { OkrCancelModal } from "@/features/okrs/components/OkrCancelModal"
import { EmptyState } from "@/components/shared/EmptyState"
import { EQUIPE_LABELS, type OkrEquipeDto, type OkrObjetivoDto } from "@/features/okrs/lib/okrs-schemas"
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
  canEditObjetivo: boolean
  canEditKr: boolean
  canUpdateValue: boolean
  currentUserId: string
  okrEncerrado: boolean
  onRefresh: () => void
  defaultOpen?: boolean
}

export function OkrObjetivoAccordion({
  objetivo,
  canEditObjetivo,
  canEditKr,
  canUpdateValue,
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
          "flex items-center gap-2 px-4 py-3 cursor-pointer select-none transition-colors",
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

        {/* Badges de equipe — antes do texto */}
        {objetivo.equipes.map((e) => (
          <OkrEquipeBadge key={e} equipe={e} />
        ))}

        {/* Descrição */}
        <span className={cn("min-w-0 flex-1 text-sm font-semibold text-text-primary truncate", isCanceled && "line-through")}>
          {objetivo.descricao}
        </span>

        {/* Motivo de cancelamento (inline quando cancelado) */}
        {isCanceled && objetivo.motivoCancelamento && (
          <span className="hidden sm:inline text-xs text-text-secondary truncate max-w-[12rem]">
            {objetivo.motivoCancelamento}
          </span>
        )}

        {/* Barra de progresso — mesma linha, alinhada à direita, largura fixa */}
        {!isCanceled && (
          <div className="shrink-0 w-28" onClick={(e) => e.stopPropagation()}>
            <OkrProgressBar value={objetivo.percentualConcluido} max={100} showLabel />
          </div>
        )}

        {/* MoreOptions — Editar / Cancelar */}
        {canEditObjetivo && !okrEncerrado && !isCanceled && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Mais opções do objetivo"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  <X className="size-4" />
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

      </div>

      {/* Conteúdo */}
      {open && (
        <div className="border-t border-border-default px-4 py-4 space-y-3">
          {objetivo.keyResults.length === 0 ? (
            <EmptyState message="Nenhum resultado-chave encontrado." />
          ) : (
            <div className="space-y-3">
              {objetivo.keyResults.map((kr, idx) => (
                <OkrKeyResultCard
                  key={kr.id}
                  kr={kr}
                  equipes={objetivo.equipes}
                  krIndex={idx + 1}
                  canEditKr={canEditKr && !isCanceled}
                  canUpdateValue={canUpdateValue}
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
              Adicionar Resultado-chave
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

// ── Badge de equipe — mesmo padrão visual do OkrSituacaoBadge ────────────────

const BASE_BADGE = "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium shrink-0"

const EQUIPE_BADGE_CONFIG: Record<OkrEquipeDto, string> = {
  QA:     "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  UX:     "border-violet-300/50  bg-violet-50  text-violet-700  dark:bg-violet-950/30  dark:text-violet-400",
  TW:     "border-amber-300/50   bg-amber-50   text-amber-700   dark:bg-amber-950/30   dark:text-amber-400",
  GESTAO: "border-sky-300/50     bg-sky-50     text-sky-700     dark:bg-sky-950/30     dark:text-sky-400",
}

function OkrEquipeBadge({ equipe }: { equipe: OkrEquipeDto }) {
  return (
    <span className={`${BASE_BADGE} ${EQUIPE_BADGE_CONFIG[equipe]}`}>
      {EQUIPE_LABELS[equipe]}
    </span>
  )
}
