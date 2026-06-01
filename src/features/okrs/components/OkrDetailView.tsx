"use client"

import * as React from "react"
import { ArrowLeft, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { OkrDashboardCards } from "@/features/okrs/components/OkrDashboardCards"
import { OkrEvolutionChart } from "@/features/okrs/components/OkrEvolutionChart"
import { OkrObjetivoAccordion } from "@/features/okrs/components/OkrObjetivoAccordion"
import { OkrSituacaoBadge } from "@/features/okrs/components/OkrSituacaoBadge"
import { OkrObjetivoFormModal } from "@/features/okrs/components/OkrObjetivoFormModal"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import {
  PERIODO_LABELS,
  type OkrDetailDto,
  type OkrEquipeDto,
} from "@/features/okrs/lib/okrs-schemas"
import { getOkr, createOkrObjetivo } from "@/features/okrs/actions/okrs"
import { buildRole, can } from "@/core/rbac/policy"

interface OkrDetailViewProps {
  okrId: string
  onBack: () => void
  userType: string
  userAccessProfile: string
  currentUserId: string
}

export function OkrDetailView({
  okrId,
  onBack,
  userType,
  userAccessProfile,
  currentUserId,
}: OkrDetailViewProps) {
  const role = buildRole(userType, userAccessProfile)
  const isMgr = can(role, "okr.create")
  const canEditObjetivo = can(role, "okr.objetivo.edit")
  const canEditKr = can(role, "okr.kr.edit")
  const canUpdateValue = can(role, "okr.kr.updateValue")

  const [okr, setOkr] = React.useState<OkrDetailDto | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [objetivoFormOpen, setObjetivoFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getOkr(okrId)
    if ("error" in res) {
      setError(res.error)
    } else {
      setOkr(res.data)
    }
    setLoading(false)
  }, [okrId])

  React.useEffect(() => { load() }, [load])

  async function handleCreateObjetivo(data: { descricao: string; equipes: OkrEquipeDto[] }) {
    setSaving(true)
    try {
      const res = await createOkrObjetivo(okrId, data)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Objetivo criado.")
      setObjetivoFormOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SectionSpinner minHeight="min-h-[50vh]" />

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onBack}>Voltar</Button>
      </div>
    )
  }

  if (!okr) return null

  const okrEncerrado = okr.situacao === "ENCERRADO"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Voltar à listagem">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary">{okr.codigo}</h1>
            <span className="text-sm text-text-secondary">{okr.ano} — {PERIODO_LABELS[okr.periodo]}</span>
            <OkrSituacaoBadge situacao={okr.situacao} />
          </div>
        </div>
      </div>

      {/* Banner OKR encerrado */}
      {okrEncerrado && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Este OKR está encerrado. Reabra-o para editar novamente.
        </div>
      )}

      {/* Cards resumo */}
      <OkrDashboardCards okr={okr} />

      {/* Gráfico */}
      <OkrEvolutionChart okr={okr} />

      {/* Objetivos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-text-primary">Objetivos</h2>
          {isMgr && !okrEncerrado && (
            <Button variant="outline" size="sm" onClick={() => setObjetivoFormOpen(true)} className="shrink-0 gap-1.5">
              <Plus className="size-4" />
              Adicionar Objetivo
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-border-default bg-surface-card">
          {okr.objetivos.length === 0 ? (
            <EmptyState message="Nenhum registro encontrado." />
          ) : (
            <div className="divide-y divide-border-default">
              {okr.objetivos.map((obj, idx) => (
                <OkrObjetivoAccordion
                  key={obj.id}
                  objetivo={obj}
                  canEditObjetivo={canEditObjetivo}
                  canEditKr={canEditKr}
                  canUpdateValue={canUpdateValue}
                  currentUserId={currentUserId}
                  okrEncerrado={okrEncerrado}
                  onRefresh={load}
                  defaultOpen={idx === 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <OkrObjetivoFormModal
        open={objetivoFormOpen}
        onClose={() => setObjetivoFormOpen(false)}
        onSubmit={handleCreateObjetivo}
        loading={saving}
      />
    </div>
  )
}
