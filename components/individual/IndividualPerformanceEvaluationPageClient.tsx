"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Calendar, Check, ChevronDown, ChevronUp, Gauge, HeartHandshake, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { UserAvatar } from "@/components/equipe/EquipePerformanceCard"
import { PerformanceEvaluationSectionGrid } from "@/components/individual/PerformanceEvaluationSectionGrid"
import type { EvaluatedUserSummary } from "@/components/individual/individualEvaluationTypes"
import { updateIndividualPerformanceEvaluation, type IndividualPerformanceEvaluationDetail } from "@/lib/actions/individual-performance-evaluations"
import {
  computePerformanceScorePercent,
  DEFAULT_EVALUATION_PERIOD,
  EVALUATION_PERIOD_SLUGS,
  evaluationDisplayCodigo,
  evaluationPeriodLabel,
  isEvaluationPeriodSlug,
  PERFORMANCE_EVALUATION_SECTIONS,
  performanceScoreQualitativeLabel,
  scorePercentToneClass,
  type EvaluationPeriodSlug,
} from "@/lib/individual-performance-evaluation"
import { cn } from "@/lib/utils"

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

export interface IndividualPerformanceEvaluationPageClientProps {
  evaluatedUserId: string
  evaluatedUser: EvaluatedUserSummary
  initialDetail: IndividualPerformanceEvaluationDetail
}

export function IndividualPerformanceEvaluationPageClient({
  evaluatedUserId,
  evaluatedUser,
  initialDetail,
}: IndividualPerformanceEvaluationPageClientProps) {
  const router = useRouter()
  const detail = initialDetail
  const [selections, setSelections] = React.useState<Record<string, number | undefined>>(() => {
    const m: Record<string, number | undefined> = {}
    for (const [k, v] of Object.entries(initialDetail.selections)) m[k] = v
    return m
  })
  const [periodo, setPeriodo] = React.useState<EvaluationPeriodSlug>(
    isEvaluationPeriodSlug(initialDetail.periodo) ? initialDetail.periodo : DEFAULT_EVALUATION_PERIOD,
  )
  const [busy, setBusy] = React.useState<"save" | "complete" | null>(null)

  const userQuery = `?userId=${encodeURIComponent(evaluatedUserId)}`
  const listHref = `/individual/avaliacoes${userQuery}`
  const fichaHref = `/individual/ficha${userQuery}`

  function setLevel(competencyId: string, level: number) {
    setSelections((prev) => ({ ...prev, [competencyId]: level }))
  }

  const previewScore = React.useMemo(
    () => computePerformanceScorePercent(selections as Record<string, number>),
    [selections],
  )

  const displayPercent = previewScore ?? detail.pontuacaoPercent
  const scoreLabel = performanceScoreQualitativeLabel(displayPercent)

  async function submit(mode: "save" | "complete") {
    const score = computePerformanceScorePercent(selections as Record<string, number>)
    if (score == null) {
      toast.error("É preciso preencher todos os critérios de avaliação.")
      return
    }
    const payload: Record<string, number> = {}
    for (const [k, v] of Object.entries(selections)) {
      if (v !== undefined && v >= 0 && v <= 4) payload[k] = v
    }
    setBusy(mode)
    try {
      const res = await updateIndividualPerformanceEvaluation({
        id: detail.id,
        selections: payload,
        mode,
        periodo,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "complete" ? "Avaliação concluída." : "Rascunho salvo.")
      router.push(listHref)
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar.")
    } finally {
      setBusy(null)
    }
  }

  const [conhecimentos, habilidades, atitudes] = PERFORMANCE_EVALUATION_SECTIONS

  return (
    <div className="space-y-4">
      <LoadingOverlay
        visible={busy != null}
        label={busy === "complete" ? "Concluindo…" : busy === "save" ? "Salvando…" : "…"}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          backHref={listHref}
          items={[
            { label: "Individual", href: fichaHref },
            { label: "Avaliações", href: listHref },
            { label: evaluationDisplayCodigo(detail.codigo) },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy != null}
            onClick={() => void submit("save")}
            className="gap-1.5"
          >
            <Save className="size-4 shrink-0" aria-hidden />
            {busy === "save" ? "Salvando…" : "Salvar como Rascunho"}
          </Button>
          <Button type="button" disabled={busy != null} onClick={() => void submit("complete")} className="gap-1.5">
            <Check className="size-4 shrink-0" aria-hidden />
            {busy === "complete" ? "Concluindo…" : "Concluir"}
          </Button>
        </div>
      </div>

      <h2 className="sr-only">Dados gerais</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-card p-4 shadow-card sm:flex-row sm:items-center">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <UserAvatar name={evaluatedUser.name || " "} photoPath={evaluatedUser.photoPath} size={72} />
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
            <p className="text-base font-semibold text-text-primary">{evaluatedUser.name}</p>
            {evaluatedUser.email ? (
              <p className="truncate text-sm text-text-secondary">{evaluatedUser.email}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border-default bg-emerald-50/70 p-4 shadow-card dark:bg-emerald-950/25">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary">Pontuação</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <Gauge className="size-4" aria-hidden />
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center">
            {displayPercent != null ? (
              <p className={cn("text-3xl font-bold tabular-nums sm:text-4xl", scorePercentToneClass(displayPercent))}>
                {displayPercent.toFixed(0).replace(".", ",")}%
              </p>
            ) : (
              <p className="text-3xl font-semibold text-text-secondary sm:text-4xl">—</p>
            )}
            <p className="mt-2 text-xs font-medium text-text-secondary">{scoreLabel}</p>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border-default bg-neutral-grey-50 p-4 shadow-card dark:bg-neutral-grey-900/30">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary">Data da avaliação</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-card text-brand-primary shadow-sm ring-1 ring-border-default">
              <Calendar className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-text-primary sm:text-3xl">
            {formatDataPt(detail.dataYmd)}
          </p>
          <div className="mt-4">
            <Select
              value={periodo}
              onValueChange={(v) => {
                if (v && isEvaluationPeriodSlug(v)) setPeriodo(v)
              }}
            >
              <SelectTrigger className="w-full bg-surface-card">
                <SelectValue>{evaluationPeriodLabel(periodo)}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {EVALUATION_PERIOD_SLUGS.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {evaluationPeriodLabel(slug)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </div>
      </div>

      <PerformanceEvaluationSectionGrid
        section={conhecimentos}
        selections={selections}
        onSelectLevel={setLevel}
        icon={<BookOpen className="size-5" aria-hidden />}
      />

      <PerformanceEvaluationSectionGrid
        section={habilidades}
        selections={selections}
        onSelectLevel={setLevel}
        icon={<Sparkles className="size-5" aria-hidden />}
      />

      <PerformanceEvaluationSectionGrid
        section={atitudes}
        selections={selections}
        onSelectLevel={setLevel}
        icon={<HeartHandshake className="size-5" aria-hidden />}
      />
    </div>
  )
}
