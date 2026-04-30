"use client"

import * as React from "react"
import Image from "next/image"
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  Save,
  Sparkles,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { UserAvatar } from "@/components/equipe/EquipePerformanceCard"
import { PerformanceEvaluationSectionGrid } from "@/components/individual/PerformanceEvaluationSectionGrid"
import {
  getIndividualPerformanceEvaluation,
  updateIndividualPerformanceEvaluation,
  type IndividualPerformanceEvaluationDetail,
} from "@/lib/actions/individual-performance-evaluations"
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

export interface EvaluatedUserSummary {
  name: string
  photoPath: string | null
  email?: string | null
}

export interface IndividualPerformanceEvaluationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluationId: string | null
  evaluatedUserId: string
  evaluatedUser: EvaluatedUserSummary
  onSaved: () => void
}

type TabId = "geral" | "conhecimentos" | "habilidades" | "atitudes"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "geral", label: "Dados gerais", icon: ClipboardList },
  { id: "conhecimentos", label: "Conhecimentos", icon: BookOpen },
  { id: "habilidades", label: "Habilidades", icon: Sparkles },
  { id: "atitudes", label: "Atitudes", icon: HeartHandshake },
]

export function IndividualPerformanceEvaluationModal({
  open,
  onOpenChange,
  evaluationId,
  evaluatedUserId,
  evaluatedUser,
  onSaved,
}: IndividualPerformanceEvaluationModalProps) {
  const [tab, setTab] = React.useState<TabId>("geral")
  const [detail, setDetail] = React.useState<IndividualPerformanceEvaluationDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [selections, setSelections] = React.useState<Record<string, number | undefined>>({})
  const [periodo, setPeriodo] = React.useState<EvaluationPeriodSlug>(DEFAULT_EVALUATION_PERIOD)
  const [busy, setBusy] = React.useState<"save" | "complete" | null>(null)

  React.useEffect(() => {
    if (!open || !evaluationId) {
      setDetail(null)
      setLoadError(null)
      setSelections({})
      setPeriodo(DEFAULT_EVALUATION_PERIOD)
      setTab("geral")
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const d = await getIndividualPerformanceEvaluation(evaluationId)
        if (cancelled) return
        if (!d || d.evaluatedUserId !== evaluatedUserId) {
          setLoadError("Avaliação não encontrada.")
          setDetail(null)
          return
        }
        setDetail(d)
        const m: Record<string, number | undefined> = {}
        for (const [k, v] of Object.entries(d.selections)) m[k] = v
        setSelections(m)
        setPeriodo(isEvaluationPeriodSlug(d.periodo) ? d.periodo : DEFAULT_EVALUATION_PERIOD)
      } catch {
        if (!cancelled) setLoadError("Não foi possível carregar a avaliação.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, evaluationId, evaluatedUserId])

  function setLevel(competencyId: string, level: number) {
    setSelections((prev) => ({ ...prev, [competencyId]: level }))
  }

  const previewScore = React.useMemo(
    () => computePerformanceScorePercent(selections as Record<string, number>),
    [selections],
  )

  async function submit(mode: "save" | "complete") {
    if (!detail) return
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
      onSaved()
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar.")
    } finally {
      setBusy(null)
    }
  }

  const sectionByTab = {
    conhecimentos: PERFORMANCE_EVALUATION_SECTIONS[0]!,
    habilidades: PERFORMANCE_EVALUATION_SECTIONS[1]!,
    atitudes: PERFORMANCE_EVALUATION_SECTIONS[2]!,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[min(92dvh,48rem)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border-default px-4 pb-3 pt-2 sm:px-5">
          <DialogTitle>Avaliação de desempenho</DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os dados gerais e as competências. Salve como rascunho ou conclua quando todas as linhas estiverem
            preenchidas.
          </DialogDescription>
          {detail ? (
            <p className="text-xs text-muted-foreground">
              Código <span className="font-mono font-semibold text-foreground">{detail.codigo}</span>
              {detail.status === "CONCLUIDA" ? (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-primary">Concluída</span>
              ) : (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Rascunho</span>
              )}
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border-default bg-muted/30 px-2 py-1.5 sm:px-3">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
                  tab === id
                    ? "bg-surface-card text-brand-primary shadow-sm ring-1 ring-border-default"
                    : "text-text-secondary hover:bg-surface-card/80 hover:text-text-primary",
                )}
              >
                <Icon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            {loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : loadError ? (
              <p className="py-12 text-center text-sm text-destructive">{loadError}</p>
            ) : tab === "geral" ? (
              <div className="mx-auto flex max-w-lg flex-col gap-6">
                <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-card p-4 shadow-card sm:flex-row sm:items-center">
                  <div className="flex shrink-0 justify-center sm:justify-start">
                    {evaluatedUser.photoPath && !evaluatedUser.photoPath.startsWith("data:") ? (
                      <Image
                        src={evaluatedUser.photoPath}
                        alt=""
                        width={88}
                        height={88}
                        unoptimized
                        className="size-[5.5rem] rounded-2xl border border-border-default object-cover"
                      />
                    ) : (
                      <UserAvatar name={evaluatedUser.name} photoPath={evaluatedUser.photoPath} size={88} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
                    <p className="text-base font-semibold text-foreground">{evaluatedUser.name}</p>
                    {evaluatedUser.email ? (
                      <p className="truncate text-sm text-muted-foreground">{evaluatedUser.email}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="avaliacao-periodo">
                    Período
                  </label>
                  <Select
                    value={periodo}
                    onValueChange={(v) => {
                      if (v && isEvaluationPeriodSlug(v)) setPeriodo(v)
                    }}
                  >
                    <SelectTrigger id="avaliacao-periodo" className="w-full">
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
                </div>

                <div
                  className="rounded-2xl border border-brand-primary/25 bg-gradient-to-br from-primary/8 via-surface-card to-surface-card p-5 shadow-card ring-1 ring-border-default"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Pontuação final</p>
                  <p className="mt-1 text-xs text-muted-foreground">
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
                        <span className="text-sm font-medium text-muted-foreground">global</span>
                      </>
                    ) : (
                      <span className="text-2xl font-semibold text-muted-foreground">—</span>
                    )}
                  </div>
                  {previewScore == null ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Preencha todas as competências para calcular a pontuação.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-2">
                <PerformanceEvaluationSectionGrid
                  section={sectionByTab[tab]}
                  selections={selections}
                  onSelectLevel={setLevel}
                  icon={
                    tab === "conhecimentos" ? (
                      <BookOpen className="size-5" aria-hidden />
                    ) : tab === "habilidades" ? (
                      <Sparkles className="size-5" aria-hidden />
                    ) : (
                      <HeartHandshake className="size-5" aria-hidden />
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border-default bg-muted/40">
          <Button
            type="button"
            variant="outline"
            disabled={busy != null || loading}
            onClick={() => onOpenChange(false)}
            className="gap-2"
          >
            <X className="size-4" aria-hidden />
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy != null || loading || !detail}
            onClick={() => void submit("save")}
            className="gap-2"
          >
            <Save className="size-4" aria-hidden />
            {busy === "save" ? "Salvando…" : "Salvar como Rascunho"}
          </Button>
          <Button
            type="button"
            disabled={busy != null || loading || !detail}
            onClick={() => void submit("complete")}
            className="gap-2"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {busy === "complete" ? "Concluindo…" : "Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
