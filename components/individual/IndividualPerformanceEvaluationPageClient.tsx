"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, HeartHandshake, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { CancelActionButton } from "@/components/qagrotis/CancelActionButton"
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
import { AvaliacaoSituacaoBadge } from "@/components/qagrotis/StatusBadge"
import type { EvaluatedUserSummary } from "@/components/individual/individualEvaluationTypes"
import { updateIndividualPerformanceEvaluation, type IndividualPerformanceEvaluationDetail } from "@/lib/actions/individual-performance-evaluations"
import {
  computePerformanceScorePercent,
  DEFAULT_EVALUATION_PERIOD,
  EVALUATION_PERIOD_SLUGS,
  evaluationPeriodLabel,
  isEvaluationPeriodSlug,
  PERFORMANCE_EVALUATION_SECTIONS,
  scorePercentToneClass,
  type EvaluationPeriodSlug,
} from "@/lib/individual-performance-evaluation"
import { cn } from "@/lib/utils"

function BlockCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-neutral-grey-50"
      >
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-text-secondary" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-text-secondary" />
        )}
      </button>

      {open ? (
        <>
          <div className="border-t border-border-default" />
          <div className="space-y-4 p-5">{children}</div>
        </>
      ) : null}
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </div>
  )
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

  function goBackToList() {
    router.push(listHref)
  }

  async function submit(mode: "save" | "complete") {
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
            { label: `Código ${detail.codigo}` },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <AvaliacaoSituacaoBadge situacao={detail.status === "CONCLUIDA" ? "Concluída" : "Rascunho"} />
          <CancelActionButton type="button" disabled={busy != null} onClick={goBackToList} />
          <Button
            type="button"
            variant="secondary"
            disabled={busy != null}
            onClick={() => void submit("save")}
            className="gap-2"
          >
            <Save className="size-4 shrink-0" aria-hidden />
            {busy === "save" ? "Salvando…" : "Salvar como Rascunho"}
          </Button>
          <Button type="button" disabled={busy != null} onClick={() => void submit("complete")} className="gap-2">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {busy === "complete" ? "Concluindo…" : "Concluir"}
          </Button>
        </div>
      </div>

      <BlockCard title="Dados gerais">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <UserAvatar name={evaluatedUser.name || " "} photoPath={evaluatedUser.photoPath} size={88} />
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
            <p className="text-base font-semibold text-text-primary">{evaluatedUser.name}</p>
            {evaluatedUser.email ? (
              <p className="truncate text-sm text-text-secondary">{evaluatedUser.email}</p>
            ) : null}
          </div>
        </div>

        <Field label="Período">
          <Select
            value={periodo}
            onValueChange={(v) => {
              if (v && isEvaluationPeriodSlug(v)) setPeriodo(v)
            }}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {EVALUATION_PERIOD_SLUGS.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {evaluationPeriodLabel(slug)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>

        <div
          className="rounded-2xl border border-brand-primary/25 bg-gradient-to-br from-primary/8 via-surface-card to-surface-card p-5 shadow-card ring-1 ring-border-default"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Pontuação final</p>
          <p className="mt-1 text-xs text-text-secondary">
            Média ponderada (Não Atende…Excelente), igual à planilha de indicadores.
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            {previewScore != null ? (
              <>
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums sm:text-5xl",
                    scorePercentToneClass(previewScore),
                  )}
                >
                  {previewScore.toFixed(1).replace(".", ",")}%
                </span>
                <span className="text-sm font-medium text-text-secondary">global</span>
              </>
            ) : (
              <span className="text-2xl font-semibold text-text-secondary">—</span>
            )}
          </div>
          {previewScore == null ? (
            <p className="mt-2 text-xs text-text-secondary">Preencha todas as competências para calcular a pontuação.</p>
          ) : null}
        </div>
      </BlockCard>

      <BlockCard title="Conhecimentos">
        <PerformanceEvaluationSectionGrid
          section={conhecimentos}
          selections={selections}
          onSelectLevel={setLevel}
          icon={<BookOpen className="size-5" aria-hidden />}
        />
      </BlockCard>

      <BlockCard title="Habilidades">
        <PerformanceEvaluationSectionGrid
          section={habilidades}
          selections={selections}
          onSelectLevel={setLevel}
          icon={<Sparkles className="size-5" aria-hidden />}
        />
      </BlockCard>

      <BlockCard title="Atitudes">
        <PerformanceEvaluationSectionGrid
          section={atitudes}
          selections={selections}
          onSelectLevel={setLevel}
          icon={<HeartHandshake className="size-5" aria-hidden />}
        />
      </BlockCard>
    </div>
  )
}
