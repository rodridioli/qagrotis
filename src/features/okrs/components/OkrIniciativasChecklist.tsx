"use client"

import * as React from "react"
import { Plus, Trash2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  INICIATIVA_STATUS_LABELS,
  type OkrIniciativaDto,
  type OkrIniciativaStatusDto,
  type OkrEquipeDto,
} from "@/features/okrs/lib/okrs-schemas"
import { OkrIniciativaFormModal } from "@/features/okrs/components/OkrIniciativaFormModal"
import {
  createOkrIniciativa,
  updateOkrIniciativa,
  deleteOkrIniciativa,
  getMembrosByEquipes,
  type OkrEquipeMembro,
} from "@/features/okrs/actions/okrs"
import { cn } from "@/core/utils"

const STATUS_DONE: OkrIniciativaStatusDto[] = ["CONCLUIDA"]
const STATUS_TOGGLE_MAP: Record<OkrIniciativaStatusDto, OkrIniciativaStatusDto> = {
  PENDENTE: "EM_ANDAMENTO",
  EM_ANDAMENTO: "CONCLUIDA",
  CONCLUIDA: "PENDENTE",
  CANCELADA: "PENDENTE",
}

function statusIcon(status: OkrIniciativaStatusDto) {
  if (status === "CONCLUIDA") return "☑"
  if (status === "CANCELADA") return "✕"
  return "☐"
}

interface OkrIniciativasChecklistProps {
  keyResultId: string
  iniciativas: OkrIniciativaDto[]
  equipes: OkrEquipeDto[]
  canManage: boolean
  canUpdateStatus: boolean
  currentUserId: string
  okrEncerrado: boolean
  onRefresh: () => void
}

export function OkrIniciativasChecklist({
  keyResultId,
  iniciativas,
  equipes,
  canManage,
  canUpdateStatus,
  currentUserId,
  okrEncerrado,
  onRefresh,
}: OkrIniciativasChecklistProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<OkrIniciativaDto | null>(null)
  const [membros, setMembros] = React.useState<OkrEquipeMembro[]>([])
  const [saving, setSaving] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)

  async function loadMembros() {
    if (equipes.length === 0) return
    const res = await getMembrosByEquipes(equipes)
    if ("data" in res) setMembros(res.data)
  }

  function openCreate() {
    loadMembros()
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(i: OkrIniciativaDto) {
    loadMembros()
    setEditTarget(i)
    setFormOpen(true)
  }

  async function handleFormSubmit(data: { descricao: string; responsaveis: string[] }) {
    setCreating(true)
    try {
      if (editTarget) {
        const res = await updateOkrIniciativa(editTarget.id, data)
        if ("error" in res) { toast.error(res.error); return }
        toast.success("Iniciativa atualizada.")
      } else {
        const res = await createOkrIniciativa(keyResultId, data)
        if ("error" in res) { toast.error(res.error); return }
        toast.success("Iniciativa criada.")
      }
      setFormOpen(false)
      onRefresh()
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleStatus(i: OkrIniciativaDto) {
    if (okrEncerrado) return
    const isMyIniciativa = i.responsaveis.some((r) => r.userId === currentUserId)
    if (!canManage && !isMyIniciativa) return

    const nextStatus = STATUS_TOGGLE_MAP[i.status]
    setSaving(i.id)
    try {
      const res = await updateOkrIniciativa(i.id, { status: nextStatus })
      if ("error" in res) { toast.error(res.error); return }
      onRefresh()
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    if (!canManage) return
    setSaving(id)
    try {
      const res = await deleteOkrIniciativa(id)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Iniciativa removida.")
      onRefresh()
    } finally {
      setSaving(null)
    }
  }

  const visibleIniciativas = canManage
    ? iniciativas
    : iniciativas.filter((i) => i.responsaveis.some((r) => r.userId === currentUserId))

  return (
    <div className="space-y-2">
      {visibleIniciativas.length === 0 ? (
        <p className="text-xs text-text-secondary italic">Nenhuma iniciativa.</p>
      ) : (
        <ul className="space-y-1.5">
          {visibleIniciativas.map((i) => {
            const isDone = STATUS_DONE.includes(i.status)
            const isCanceled = i.status === "CANCELADA"
            const isMyIniciativa = i.responsaveis.some((r) => r.userId === currentUserId)
            const canToggle = !okrEncerrado && (canManage || isMyIniciativa) && !isCanceled
            const isSaving = saving === i.id

            return (
              <li
                key={i.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  canToggle && "hover:bg-muted/40 cursor-pointer",
                  (isDone || isCanceled) && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => canToggle && handleToggleStatus(i)}
                  disabled={!canToggle || isSaving}
                  className={cn(
                    "mt-0.5 shrink-0 text-base leading-none",
                    canToggle ? "cursor-pointer text-text-secondary hover:text-primary" : "cursor-default text-text-secondary",
                    isDone && "text-primary",
                    isCanceled && "text-destructive",
                  )}
                  aria-label={`Marcar como ${INICIATIVA_STATUS_LABELS[STATUS_TOGGLE_MAP[i.status]]}`}
                >
                  {isSaving ? "..." : statusIcon(i.status)}
                </button>
                <div className="min-w-0 flex-1">
                  <span className={cn("block text-text-primary", isDone && "line-through", isCanceled && "line-through text-text-secondary")}>
                    {i.descricao}
                  </span>
                  {i.responsaveis.length > 0 && (
                    <span className="text-xs text-text-secondary">
                      {i.responsaveis.map((r) => r.name).join(", ")}
                    </span>
                  )}
                </div>
                {canManage && !okrEncerrado && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(i)}
                      className="rounded p-1 text-text-secondary hover:bg-muted hover:text-text-primary"
                      aria-label="Editar iniciativa"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(i.id)}
                      disabled={isSaving}
                      className="rounded p-1 text-text-secondary hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Excluir iniciativa"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage && !okrEncerrado && (
        <Button variant="ghost" size="sm" onClick={openCreate} className="h-7 gap-1 text-xs">
          <Plus className="size-3.5" />
          Iniciativa
        </Button>
      )}

      <OkrIniciativaFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        loading={creating}
        membros={membros}
        initial={editTarget ?? undefined}
      />
    </div>
  )
}
