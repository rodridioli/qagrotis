"use client"

import * as React from "react"
import { History, MoreVertical, Pencil, TrendingUp, X } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OkrProgressBar } from "@/features/okrs/components/OkrProgressBar"
import { OkrRiscoBadge } from "@/features/okrs/components/OkrRiscoBadge"
import { OkrKeyResultFormModal } from "@/features/okrs/components/OkrKeyResultFormModal"
import { OkrKrUpdateModal } from "@/features/okrs/components/OkrKrUpdateModal"
import { OkrCancelModal } from "@/features/okrs/components/OkrCancelModal"
import { OkrKrHistoricoModal } from "@/features/okrs/components/OkrKrHistoricoModal"
import {
  UNIDADE_LABELS,
  type OkrKeyResultDto,
  type OkrEquipeDto,
} from "@/features/okrs/lib/okrs-schemas"
import {
  updateOkrKeyResult,
  cancelOkrKeyResult,
  getMembrosByEquipes,
  type OkrEquipeMembro,
} from "@/features/okrs/actions/okrs"
import { UserAvatar } from "@/features/equipe/components/EquipePerformanceCard"
import { cn } from "@/core/utils"

interface OkrKeyResultCardProps {
  kr: OkrKeyResultDto
  equipes: OkrEquipeDto[]
  krIndex: number
  canEditKr: boolean
  canUpdateValue: boolean
  currentUserId: string
  okrEncerrado: boolean
  onRefresh: () => void
}

export function OkrKeyResultCard({
  kr,
  equipes,
  krIndex,
  canEditKr,
  canUpdateValue,
  currentUserId,
  okrEncerrado,
  onRefresh,
}: OkrKeyResultCardProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [updateOpen, setUpdateOpen] = React.useState(false)
  const [historicoOpen, setHistoricoOpen] = React.useState(false)
  const [membros, setMembros] = React.useState<OkrEquipeMembro[]>([])
  const [saving, setSaving] = React.useState(false)

  const unidadeLabel =
    kr.unidade === "PERSONALIZADA"
      ? (kr.unidadePersonalizada ?? "")
      : UNIDADE_LABELS[kr.unidade]

  async function loadMembros() {
    if (equipes.length === 0) return
    const res = await getMembrosByEquipes(equipes)
    if ("data" in res) setMembros(res.data)
  }

  function openEdit() {
    loadMembros()
    setEditOpen(true)
  }

  async function handleEdit(data: Parameters<typeof updateOkrKeyResult>[1]) {
    setSaving(true)
    try {
      const res = await updateOkrKeyResult(kr.id, data)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Key Result atualizado.")
      setEditOpen(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(motivo: string) {
    setSaving(true)
    try {
      const res = await cancelOkrKeyResult(kr.id, { motivoCancelamento: motivo })
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Key Result cancelado.")
      setCancelOpen(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const isCanceled = kr.situacao === "CANCELADO"
  const isMyKr = kr.responsaveis.some((r) => r.userId === currentUserId)

  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-surface-card p-4 space-y-3 transition-opacity",
        isCanceled && "opacity-60",
      )}
    >
      {/* Header — descrição + badges + barra de progresso inline + MoreOptions */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium text-text-primary", isCanceled && "line-through")}>
              <span className="font-semibold">KR{String(krIndex).padStart(2, "0")}:</span>{" "}
              {kr.descricao}
            </span>
          </div>
          {isCanceled && kr.motivoCancelamento && (
            <p className="mt-0.5 text-xs text-text-secondary">
              <span className="font-medium">Motivo:</span> {kr.motivoCancelamento}
            </p>
          )}
        </div>

        {/* Avatares + barra de progresso + valor — alinhados à direita */}
        {!isCanceled && (
          <div className="shrink-0 flex items-center gap-3">
            {/* Avatares dos responsáveis */}
            {kr.responsaveis.length > 0 && (
              <div className="flex -space-x-1.5">
                {kr.responsaveis.slice(0, 4).map((r) => (
                  <div key={r.userId} title={r.name}>
                    <UserAvatar name={r.name} photoPath={r.photoPath} size={24} />
                  </div>
                ))}
                {kr.responsaveis.length > 4 && (
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-grey-100 text-[10px] font-semibold text-text-secondary ring-2 ring-border-default"
                  >
                    +{kr.responsaveis.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Badge de risco */}
            <OkrRiscoBadge risco={kr.risco} />

            {/* Barra de progresso + valor/meta */}
            <div className="flex flex-col items-end gap-0.5 w-28">
              <OkrProgressBar value={kr.progressoPercent} max={100} showLabel />
              <span className="text-[11px] tabular-nums text-text-secondary">
                {kr.valorAtual} / {kr.meta} {unidadeLabel}
              </span>
            </div>
          </div>
        )}

        {/* MoreOptions — Histórico (sempre) + Atualizar / Editar / Cancelar */}
        {!isCanceled && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Mais opções do resultado-chave"
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem onClick={() => setHistoricoOpen(true)}>
                <History className="size-4" />
                Histórico
              </DropdownMenuItem>
              {!okrEncerrado && ((canUpdateValue && isMyKr) || canEditKr) && (
                <DropdownMenuItem onClick={() => setUpdateOpen(true)}>
                  <TrendingUp className="size-4" />
                  Atualizar
                </DropdownMenuItem>
              )}
              {!okrEncerrado && canEditKr && (
                <DropdownMenuItem onClick={openEdit}>
                  <Pencil className="size-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {!okrEncerrado && canEditKr && (
                <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                  <X className="size-4" />
                  Cancelar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Modais */}
      <OkrKeyResultFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        loading={saving}
        membros={membros}
        initial={kr}
      />
      <OkrKrUpdateModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        onSubmit={async (valorAtual) => {
          const { updateOkrKeyResultValorAtual } = await import("@/features/okrs/actions/okrs")
          setSaving(true)
          try {
            const res = await updateOkrKeyResultValorAtual(kr.id, { valorAtual })
            if ("error" in res) { toast.error(res.error); return }
            toast.success("Valor atualizado.")
            setUpdateOpen(false)
            onRefresh()
          } finally {
            setSaving(false)
          }
        }}
        kr={kr}
        loading={saving}
      />
      <OkrCancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        titulo="Cancelar Resultado-chave"
        descricao={kr.descricao}
        loading={saving}
      />
      <OkrKrHistoricoModal
        open={historicoOpen}
        onClose={() => setHistoricoOpen(false)}
        krId={kr.id}
        krDescricao={`KR${String(krIndex).padStart(2, "0")}: ${kr.descricao}`}
        unidadeLabel={unidadeLabel}
      />
    </div>
  )
}
