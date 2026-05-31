"use client"

import * as React from "react"
import { Pencil, X, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { OkrProgressBar } from "@/features/okrs/components/OkrProgressBar"
import { OkrRiscoBadge } from "@/features/okrs/components/OkrRiscoBadge"
import { OkrSituacaoBadge } from "@/features/okrs/components/OkrSituacaoBadge"
import { OkrIniciativasChecklist } from "@/features/okrs/components/OkrIniciativasChecklist"
import { OkrKeyResultFormModal } from "@/features/okrs/components/OkrKeyResultFormModal"
import { OkrKrUpdateModal } from "@/features/okrs/components/OkrKrUpdateModal"
import { OkrCancelModal } from "@/features/okrs/components/OkrCancelModal"
import {
  UNIDADE_LABELS,
  type OkrKeyResultDto,
  type OkrEquipeDto,
  type OkrPeriodoDto,
} from "@/features/okrs/lib/okrs-schemas"
import {
  updateOkrKeyResult,
  cancelOkrKeyResult,
  getMembrosByEquipes,
  type OkrEquipeMembro,
} from "@/features/okrs/actions/okrs"
import { cn } from "@/core/utils"

interface OkrKeyResultCardProps {
  kr: OkrKeyResultDto
  equipes: OkrEquipeDto[]
  periodo: OkrPeriodoDto
  canEditKr: boolean
  canUpdateValue: boolean
  canManageIniciativas: boolean
  canUpdateIniciativaStatus: boolean
  currentUserId: string
  okrEncerrado: boolean
  onRefresh: () => void
}

export function OkrKeyResultCard({
  kr,
  equipes,
  periodo,
  canEditKr,
  canUpdateValue,
  canManageIniciativas,
  canUpdateIniciativaStatus,
  currentUserId,
  okrEncerrado,
  onRefresh,
}: OkrKeyResultCardProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [updateOpen, setUpdateOpen] = React.useState(false)
  const [membros, setMembros] = React.useState<OkrEquipeMembro[]>([])
  const [saving, setSaving] = React.useState(false)
  const [showEvolucao, setShowEvolucao] = React.useState(false)

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
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium text-text-primary", isCanceled && "line-through")}>
              {kr.descricao}
            </span>
            <OkrSituacaoBadge situacao={kr.situacao} />
            {!isCanceled && <OkrRiscoBadge risco={kr.risco} />}
          </div>
          {isCanceled && kr.motivoCancelamento && (
            <p className="text-xs text-text-secondary">
              <span className="font-medium">Motivo:</span> {kr.motivoCancelamento}
            </p>
          )}
          {kr.responsaveis.length > 0 && (
            <p className="text-xs text-text-secondary">
              Responsáveis: {kr.responsaveis.map((r) => r.name).join(", ")}
            </p>
          )}
        </div>

        {!okrEncerrado && !isCanceled && (
          <div className="flex shrink-0 items-center gap-1">
            {(canUpdateValue && isMyKr) || canEditKr ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setUpdateOpen(true)}
                aria-label="Atualizar valor"
              >
                <TrendingUp className="size-4" />
              </Button>
            ) : null}
            {canEditKr && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={openEdit}
                  aria-label="Editar Key Result"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCancelOpen(true)}
                  aria-label="Cancelar Key Result"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Progresso */}
      {!isCanceled && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="tabular-nums">
              {kr.valorAtual} / {kr.meta} {unidadeLabel}
            </span>
            <span className="tabular-nums font-semibold text-text-primary">
              {kr.progressoPercent.toFixed(0)}%
            </span>
          </div>
          <OkrProgressBar value={kr.progressoPercent} max={100} />
        </div>
      )}

      {/* Evolução mensal */}
      {!isCanceled && kr.evolucao.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEvolucao((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
          >
            {showEvolucao ? "▲" : "▼"} Evolução mensal
          </button>
          {showEvolucao && (
            <div className="mt-2 flex flex-wrap gap-2">
              {kr.evolucao.map((e) => (
                <div
                  key={`${e.ano}-${e.mes}`}
                  className="rounded-md border border-border-default bg-muted/40 px-2 py-1 text-center"
                >
                  <div className="text-xs font-medium text-text-secondary">
                    {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(e.ano, e.mes - 1))}
                  </div>
                  <div className="text-xs tabular-nums font-semibold text-text-primary">
                    {e.valor} {unidadeLabel}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Iniciativas */}
      <div className="border-t border-border-default pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Iniciativas
        </p>
        <OkrIniciativasChecklist
          keyResultId={kr.id}
          iniciativas={kr.iniciativas}
          equipes={equipes}
          canManage={canManageIniciativas && !isCanceled}
          canUpdateStatus={canUpdateIniciativaStatus}
          currentUserId={currentUserId}
          okrEncerrado={okrEncerrado}
          onRefresh={onRefresh}
        />
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
        titulo="Cancelar Key Result"
        descricao={kr.descricao}
        loading={saving}
      />
    </div>
  )
}
