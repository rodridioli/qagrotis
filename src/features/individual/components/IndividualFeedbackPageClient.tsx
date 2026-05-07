"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Calendar, Check, MessageSquare, Save, User } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { PageBreadcrumb } from "@/components/shared/PageBreadcrumb"
import { LoadingOverlay } from "@/components/shared/LoadingOverlay"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { UserAvatar } from "@/features/equipe/components/EquipePerformanceCard"
import type { EvaluatedUserSummary } from "@/features/individual/components/individualEvaluationTypes"
import {
  createAndSaveIndividualFeedback,
  updateIndividualFeedback,
} from "@/features/individual/actions/individual-feedbacks"
import {
  feedbackDisplayCodigo,
  feedbackTipoLabel,
  isFeedbackTipoSlug,
  FEEDBACK_TIPO_SLUGS,
  FEEDBACK_TIPO_LABELS,
  type IndividualFeedbackDetail,
  type IndividualFeedbackStatusDto,
  type FeedbackTipoSlug,
} from "@/features/individual/lib/individual-feedback"
import {
  EVALUATION_PERIOD_SLUGS,
  evaluationPeriodLabel,
  isEvaluationPeriodSlug,
} from "@/features/individual/lib/individual-performance-evaluation"

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

// ── Campo config por tipo ─────────────────────────────────────────────────────

interface FieldConfig {
  key: string
  label: string
  placeholder: string
}

const CAMPOS_BY_TIPO: Record<FeedbackTipoSlug, FieldConfig[]> = {
  POSITIVO: [
    { key: "contexto", label: "Contexto", placeholder: "Descreva o contexto em que o comportamento ocorreu…" },
    { key: "feedback", label: "Feedback", placeholder: "Descreva o comportamento observado…" },
    { key: "impacto", label: "Impacto", placeholder: "Qual foi o impacto positivo gerado…" },
  ],
  DESENVOLVIMENTO: [
    { key: "contexto", label: "Contexto", placeholder: "Descreva o contexto em que o comportamento ocorreu…" },
    { key: "feedback", label: "Feedback", placeholder: "Descreva o comportamento observado…" },
    { key: "impacto", label: "Impacto", placeholder: "Qual foi o impacto gerado…" },
    { key: "sugestao", label: "Sugestão", placeholder: "Sugira como desenvolver este ponto…" },
  ],
  CORRETIVO: [
    { key: "contexto", label: "Contexto", placeholder: "Descreva o contexto em que o comportamento ocorreu…" },
    { key: "feedback", label: "Feedback", placeholder: "Descreva o comportamento a ser corrigido…" },
    { key: "impacto", label: "Impacto", placeholder: "Qual foi o impacto negativo gerado…" },
    { key: "acaoEsperada", label: "Ação Esperada", placeholder: "Descreva a ação ou mudança esperada…" },
  ],
  FORMAL_CICLO: [
    { key: "pontosPositivos", label: "Pontos Positivos", placeholder: "Liste os principais pontos positivos…" },
    { key: "pontosMelhoria", label: "Pontos de Melhoria", placeholder: "Liste os pontos de melhoria identificados…" },
    { key: "avaliacaoGeral", label: "Avaliação Geral", placeholder: "Síntese da avaliação do ciclo…" },
    { key: "proximosPassos", label: "Próximos Passos", placeholder: "Descreva os próximos passos acordados…" },
  ],
  TREZENTOS_SESSENTA: [
    { key: "contexto", label: "Contexto", placeholder: "Descreva o período/contexto da avaliação 360°…" },
    { key: "percepcaoPares", label: "Percepção dos Pares", placeholder: "Consolidado da percepção dos pares…" },
    { key: "percepcaoLider", label: "Percepção do Líder", placeholder: "Percepção do líder direto…" },
    { key: "resumo", label: "Resumo", placeholder: "Síntese geral dos resultados…" },
  ],
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface IndividualFeedbackPageClientProps {
  evaluatedUserId: string
  evaluatedUser: EvaluatedUserSummary
  /** null = novo feedback. */
  initialDetail: IndividualFeedbackDetail | null
  /** ISO yyyy-mm-dd — obrigatório quando initialDetail é null. */
  todayYmd?: string
  /** Sobrescreve o href de volta (usado pelo avaliado em /individual/meus-feedbacks). */
  backHref?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IndividualFeedbackPageClient({
  evaluatedUserId,
  evaluatedUser,
  initialDetail,
  todayYmd,
  backHref,
}: IndividualFeedbackPageClientProps) {
  const router = useRouter()
  const isNew = initialDetail === null

  const [tipo, setTipo] = React.useState<FeedbackTipoSlug>(
    initialDetail && isFeedbackTipoSlug(initialDetail.tipo) ? initialDetail.tipo : "POSITIVO",
  )

  const [periodo, setPeriodo] = React.useState<string>(
    initialDetail?.periodo ?? "T1_TRIMESTRE",
  )

  const [campos, setCampos] = React.useState<Record<string, string>>(() => {
    if (!initialDetail) return {}
    return Object.fromEntries(
      Object.entries(initialDetail.campos as unknown as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
    )
  })

  const [busy, setBusy] = React.useState<"save" | "complete" | null>(null)
  const navigatingAway = React.useRef(false)
  const [feedbackStatus, setFeedbackStatus] = React.useState<IndividualFeedbackStatusDto>(
    initialDetail?.status ?? "RASCUNHO",
  )
  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<Set<string>>(new Set())

  const isViewOnly = feedbackStatus === "CONCLUIDA"

  React.useEffect(() => {
    if (initialDetail) setFeedbackStatus(initialDetail.status)
  }, [initialDetail])

  const mountedRef = React.useRef(false)
  React.useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setCampos({})
  }, [tipo])

  const userQuery = `?userId=${encodeURIComponent(evaluatedUserId)}`
  const listHref = backHref ?? `/individual/feedbacks${userQuery}`

  function setField(key: string, value: string) {
    setCampos((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors.has(key) && value.trim()) {
      setFieldErrors((prev) => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  const fields = CAMPOS_BY_TIPO[tipo]

  function validateForm(): boolean {
    const errors = new Set<string>()
    for (const f of fields) {
      if (!(campos[f.key] ?? "").trim()) errors.add(f.key)
    }
    setFieldErrors(errors)
    if (errors.size > 0) {
      const first = fields.find((f) => errors.has(f.key))
      toast.error(`O campo "${first?.label}" é obrigatório.`)
      document.getElementById(`feedback-field-${first?.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      return false
    }
    return true
  }

  async function submit(mode: "save" | "complete") {
    if (!validateForm()) return
    setBusy(mode)
    try {
      if (isNew) {
        const res = await createAndSaveIndividualFeedback({
          evaluatedUserId,
          tipo,
          periodo,
          campos,
          mode,
        })
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        navigatingAway.current = true
        if (mode === "complete") {
          const sep = listHref.includes("?") ? "&" : "?"
          router.push(`${listHref}${sep}completed=1`)
          return
        }
        toast.success("Feedback salvo.")
        router.push(`/individual/feedbacks/${res.id}${userQuery}`)
      } else {
        const res = await updateIndividualFeedback({
          id: initialDetail.id,
          tipo,
          periodo,
          campos,
          mode,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        if (mode === "complete") {
          const sep = listHref.includes("?") ? "&" : "?"
          navigatingAway.current = true
          router.push(`${listHref}${sep}completed=1`)
          return
        }
        setFeedbackStatus("RASCUNHO")
        toast.success("Feedback salvo.")
        router.refresh()
      }
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar.")
    } finally {
      if (!navigatingAway.current) setBusy(null)
    }
  }

  const dataYmd = isNew ? (todayYmd ?? "") : initialDetail.dataYmd

  return (
    <div className="space-y-4">
      <LoadingOverlay
        visible={busy != null}
        label={busy === "complete" ? "Concluindo…" : busy === "save" ? "Salvando…" : "…"}
      />

      {/* Header row: breadcrumb + action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <PageBreadcrumb
            backHref={listHref}
            items={[
              { label: "Feedbacks", href: listHref },
              {
                label: isNew
                  ? "Novo feedback"
                  : feedbackDisplayCodigo(initialDetail.codigo),
              },
            ]}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isViewOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-grey-300 bg-neutral-grey-100 px-3 py-1 text-xs font-medium text-text-secondary">
              Somente visualização — feedback concluído
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

      {/* Info cards: Colaborador + Data */}
      <h2 className="sr-only">Dados gerais</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        {/* Colaborador card */}
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-sm text-text-secondary">Colaborador</p>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <User className="size-5" aria-hidden />
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 justify-center sm:justify-start">
              <UserAvatar
                name={evaluatedUser.name || " "}
                photoPath={evaluatedUser.photoPath}
                size={56}
                className="rounded-xl ring-0"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
              <p className="text-base font-semibold text-text-primary">{evaluatedUser.name}</p>
              {evaluatedUser.email ? (
                <p className="truncate text-sm text-text-secondary">{evaluatedUser.email}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Data e Período card */}
        <div className="flex flex-col rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-sm text-text-secondary">Data e período</span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <Calendar className="size-5" aria-hidden />
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-3">
            <p className="text-2xl font-bold tabular-nums text-text-primary sm:text-3xl">
              {formatDataPt(dataYmd)}
            </p>
            {isViewOnly ? (
              <p className="text-sm font-medium text-text-primary">
                {evaluationPeriodLabel(periodo)}
              </p>
            ) : (
              <Select
                value={periodo}
                onValueChange={(v) => {
                  if (v && isEvaluationPeriodSlug(v)) setPeriodo(v)
                }}
              >
                <SelectTrigger
                  id="feedback-periodo"
                  className="h-9 w-full max-w-xs bg-surface-input"
                  disabled={busy != null}
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
            )}
          </div>
        </div>
      </div>

      {/* Feedback form card */}
      <div className="rounded-xl border border-border-default bg-surface-card shadow-card">
        <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <MessageSquare className="size-5" aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-text-primary">
            {isNew ? "Novo Feedback" : feedbackDisplayCodigo(initialDetail.codigo)}
          </h2>
          {!isNew && (
            <span className="ml-auto text-sm text-text-secondary">
              {feedbackTipoLabel(tipo)}
            </span>
          )}
        </div>

        <div className="space-y-6 p-5">
          {/* Tipo select */}
          <div className="space-y-1.5">
            <label htmlFor="feedback-tipo" className="block text-sm font-medium text-text-primary">
              Tipo <span className="text-destructive" aria-hidden>*</span>
            </label>
            {isViewOnly ? (
              <p className="text-sm font-medium text-text-primary">
                {feedbackTipoLabel(tipo)}
              </p>
            ) : (
              <Select
                value={tipo}
                onValueChange={(v) => {
                  if (v && isFeedbackTipoSlug(v)) setTipo(v)
                }}
              >
                <SelectTrigger
                  id="feedback-tipo"
                  className="h-9 w-full max-w-xs bg-surface-input"
                  disabled={busy != null}
                >
                  <SelectValue>{FEEDBACK_TIPO_LABELS[tipo]}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {FEEDBACK_TIPO_SLUGS.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {FEEDBACK_TIPO_LABELS[slug]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            )}
          </div>

          {/* Dynamic fields */}
          <div className="space-y-5">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label
                  htmlFor={`feedback-field-${field.key}`}
                  className="block text-sm font-medium text-text-primary"
                >
                  {field.label}
                  {!isViewOnly && (
                    <span className="text-destructive" aria-hidden> *</span>
                  )}
                </label>
                {isViewOnly ? (
                  <p className="whitespace-pre-wrap text-sm text-text-primary">
                    {(campos[field.key] ?? "") || <span className="text-text-secondary italic">—</span>}
                  </p>
                ) : (
                  <textarea
                    id={`feedback-field-${field.key}`}
                    value={campos[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={busy != null}
                    rows={4}
                    aria-invalid={fieldErrors.has(field.key)}
                    className={[
                      "w-full resize-y rounded-lg border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                      fieldErrors.has(field.key)
                        ? "border-destructive bg-surface-input focus-visible:ring-destructive"
                        : "border-border-default bg-surface-input focus-visible:ring-brand-primary",
                    ].join(" ")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCompleteOpen}
        onOpenChange={setConfirmCompleteOpen}
        title="Concluir feedback?"
        description={`O feedback será enviado para ${evaluatedUser.name} e não poderá mais ser editado.`}
        confirmLabel="Concluir feedback"
        confirmIcon={<Check className="size-4 shrink-0" aria-hidden />}
        buttonVariant="default"
        onConfirm={() => {
          setConfirmCompleteOpen(false)
          void submit("complete")
        }}
      />
    </div>
  )
}
