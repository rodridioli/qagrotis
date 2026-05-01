"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Calendar, Check, Gauge, HeartHandshake, Save, Sparkles, User } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { AvaliacaoSituacaoBadge } from "@/components/qagrotis/StatusBadge"
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
import {
  createAndSaveIndividualPerformanceEvaluation,
  updateIndividualPerformanceEvaluation,
  type IndividualPerformanceEvaluationDetail,
  type IndividualPerformanceEvaluationStatusDto,
} from "@/lib/actions/individual-performance-evaluations"
import {
  computePerformanceScorePercent,
  DEFAULT_EVALUATION_PERIOD,
  EVALUATION_PERIOD_SLUGS,
  evaluationDisplayCodigo,
  evaluationPeriodLabel,
  isEvaluationPeriodSlug,
  PERFORMANCE_EVALUATION_SECTIONS,
  performanceScoreQualitativeLabel,
  scorePercentGaugeIconClass,
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
  /** null = nova avaliação (ainda não existe no banco). */
  initialDetail: IndividualPerformanceEvaluationDetail | null
  /** ISO yyyy-mm-dd — obrigatório quando initialDetail é null. */
  todayYmd?: string
}

export function IndividualPerformanceEvaluationPageClient({
  evaluatedUserId,
  evaluatedUser,
  initialDetail,
  todayYmd,
}: IndividualPerformanceEvaluationPageClientProps) {
  const router = useRouter()
  const isNew = initialDetail === null

  const [selections, setSelections] = React.useState<Record<string, number | undefined>>(() => {
    if (!initialDetail) return {}
    const m: Record<string, number | undefined> = {}
    for (const [k, v] of Object.entries(initialDetail.selections)) m[k] = v
    return m
  })

  const [periodo, setPeriodo] = React.useState<EvaluationPeriodSlug>(
    initialDetail && isEvaluationPeriodSlug(initialDetail.periodo)
      ? initialDetail.periodo
      : DEFAULT_EVALUATION_PERIOD,
  )

  const [busy, setBusy] = React.useState<"save" | "complete" | null>(null)
  const [evalStatus, setEvalStatus] = React.useState<IndividualPerformanceEvaluationStatusDto>(
    initialDetail?.status ?? "RASCUNHO",
  )
  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false)

  /** Avaliação concluída → somente visualização, sem edição. */
  const isViewOnly = evalStatus === "CONCLUIDA"

  React.useEffect(() => {
    if (initialDetail) setEvalStatus(initialDetail.status)
  }, [initialDetail])

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

  const displayPercent = previewScore ?? (initialDetail?.pontuacaoPercent ?? null)
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
      if (isNew) {
        // Nova avaliação: cria e salva em uma operação atômica
        const res = await createAndSaveIndividualPerformanceEvaluation({
          evaluatedUserId,
          selections: payload,
          mode,
          periodo,
        })
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        if (mode === "complete") {
          toast.success(`Avaliação concluída e enviada para o ${evaluatedUser.name}.`)
          router.push(listHref)
          router.refresh()
          return
        }
        toast.success("Avaliação salva com sucesso.")
        // Redireciona para a página de edição com o ID real
        router.push(`/individual/avaliacoes/${res.id}${userQuery}`)
        router.refresh()
      } else {
        // Edição de avaliação existente
        const res = await updateIndividualPerformanceEvaluation({
          id: initialDetail.id,
          selections: payload,
          mode,
          periodo,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        if (mode === "complete") {
          toast.success(`Avaliação concluída e enviada para o ${evaluatedUser.name}.`)
          router.push(listHref)
          router.refresh()
          return
        }
        setEvalStatus("RASCUNHO")
        toast.success("Avaliação salva com sucesso.")
        router.refresh()
      }
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar.")
    } finally {
      setBusy(null)
    }
  }

  const dataYmd = isNew ? (todayYmd ?? "") : initialDetail.dataYmd
  const [conhecimentos, habilidades, atitudes] = PERFORMANCE_EVALUATION_SECTIONS

  return (
    <div className="space-y-4">
      <LoadingOverlay
        visible={busy != null}
        label={busy === "complete" ? "Concluindo…" : busy === "save" ? "Salvando…" : "…"}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <PageBreadcrumb
            backHref={listHref}
            items={[
              { label: "Individual", href: fichaHref },
              { label: "Avaliações", href: listHref },
              { label: isNew ? "Nova avaliação" : evaluationDisplayCodigo(initialDetail.codigo) },
            ]}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isViewOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-grey-300 bg-neutral-grey-100 px-3 py-1 text-xs font-medium text-text-secondary">
              Somente visualização — avaliação concluída
            </span>
          ) : (
            <>
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
              <Button
                type="button"
                disabled={busy != null}
                onClick={() => setConfirmCompleteOpen(true)}
                className="gap-1.5"
              >
                <Check className="size-4 shrink-0" aria-hidden />
                {busy === "complete" ? "Concluindo…" : "Concluir"}
              </Button>
            </>
          )}
        </div>
      </div>

      <h2 className="sr-only">Dados gerais</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-sm text-text-secondary">Colaborador</p>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <User className="size-5" aria-hidden />
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 justify-center sm:justify-start">
              <UserAvatar name={evaluatedUser.name || " "} photoPath={evaluatedUser.photoPath} size={56} className="rounded-xl ring-0" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
              <p className="text-base font-semibold text-text-primary">{evaluatedUser.name}</p>
              {evaluatedUser.email ? (
                <p className="truncate text-sm text-text-secondary">{evaluatedUser.email}</p>
              ) : null}
              {!isNew && (
                <div className="pt-1">
                  <AvaliacaoSituacaoBadge situacao={evalStatus === "CONCLUIDA" ? "Concluída" : "Rascunho"} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-sm text-text-secondary">Pontuação</span>
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                scorePercentGaugeIconClass(displayPercent ?? null),
              )}
            >
              <Gauge className="size-5" aria-hidden />
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center">
            {displayPercent != null ? (
              <p className={cn("text-5xl font-bold leading-none tabular-nums sm:text-6xl", scorePercentToneClass(displayPercent))}>
                {displayPercent.toFixed(0).replace(".", ",")}%
              </p>
            ) : (
              <p className="text-5xl font-semibold leading-none text-text-secondary sm:text-6xl">—</p>
            )}
            <p className="mt-3 text-xs font-medium text-text-secondary">{scoreLabel}</p>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-sm text-text-secondary">Data e período</span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <Calendar className="size-5" aria-hidden />
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums text-text-primary sm:text-3xl">
                {formatDataPt(dataYmd)}
              </p>
            </div>
            <div className="min-w-0">
              {isViewOnly ? (
                <p className="text-sm font-medium text-text-primary">{evaluationPeriodLabel(periodo)}</p>
              ) : (
                <>
                  <label htmlFor="avaliacao-periodo" className="sr-only">
                    Período
                  </label>
                  <Select
                    value={periodo}
                    onValueChange={(v) => {
                      if (v && isEvaluationPeriodSlug(v)) setPeriodo(v)
                    }}
                  >
                    <SelectTrigger
                      id="avaliacao-periodo"
                      className="h-9 w-full max-w-[11rem] min-w-0 bg-neutral-grey-50 sm:max-w-[13rem]"
                    >
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <PerformanceEvaluationSectionGrid
        section={conhecimentos}
        selections={selections}
        onSelectLevel={setLevel}
        icon={<BookOpen className="size-5" aria-hidden />}
        disabled={isViewOnly}
      />

      <PerformanceEvaluationSectionGrid
        section={habilidades}
        selections={selections}
        onSelectLevel={setLevel}
        icon={<Sparkles className="size-5" aria-hidden />}
        disabled={isViewOnly}
      />

      <PerformanceEvaluationSectionGrid
        section={atitudes}
        selections={selections}
        onSelectLevel={setLevel}
        icon={<HeartHandshake className="size-5" aria-hidden />}
        disabled={isViewOnly}
      />

      <ConfirmDialog
        open={confirmCompleteOpen}
        onOpenChange={setConfirmCompleteOpen}
        title="Concluir avaliação?"
        description={`A avaliação será enviada para ${evaluatedUser.name} e não poderá mais ser editada. Caso envie uma avaliação errada, será necessário excluí-la e criar uma nova.`}
        confirmLabel="Concluir avaliação"
        buttonVariant="default"
        onConfirm={() => {
          setConfirmCompleteOpen(false)
          void submit("complete")
        }}
      />
    </div>
  )
}
