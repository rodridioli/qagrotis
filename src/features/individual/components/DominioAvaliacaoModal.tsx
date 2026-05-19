"use client"

import * as React from "react"
import {
  Star,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Pencil,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type {
  DominioProduto,
  DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  avaliacaoId: string
  configSnapshot: DominioProduto[]
  onSubmit: (id: string, respostas: DominioAvaliacaoResposta[]) => Promise<{ error?: string }>
}

type WizardStep = "welcome" | number | "review" | "done"
type Direction = "forward" | "backward"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcProdutoMedia(
  produto: DominioProduto,
  respostas: Record<string, Record<string, number>>,
): number | null {
  const scores: number[] = []
  for (const modulo of produto.modulos) {
    const val = respostas[produto.id]?.[modulo.id]
    if (val) scores.push((val / 5) * 100)
  }
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function calcMediaGeral(
  produtos: DominioProduto[],
  respostas: Record<string, Record<string, number>>,
): number {
  const avgs: number[] = []
  for (const p of produtos) {
    const m = calcProdutoMedia(p, respostas)
    if (m !== null) avgs.push(m)
  }
  if (avgs.length === 0) return 0
  return avgs.reduce((a, b) => a + b, 0) / avgs.length
}

function isProdutoComplete(
  produto: DominioProduto,
  respostas: Record<string, Record<string, number>>,
): boolean {
  return produto.modulos.every((m) => !!respostas[produto.id]?.[m.id])
}

function slideClass(direction: Direction): string {
  return direction === "forward"
    ? "animate-in fade-in slide-in-from-right-4 duration-200"
    : "animate-in fade-in slide-in-from-left-4 duration-200"
}

// ─── StarRating ────────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = React.useState(0)

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
      role="radiogroup"
      aria-label="Avaliação de 1 a 5 estrelas"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            className={cn(
              "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
              filled ? "text-amber-400" : "text-neutral-grey-300 hover:text-amber-300",
            )}
          >
            <Star
              className={cn("size-6 sm:size-5 transition-colors", filled ? "fill-current" : "")}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

// ─── WelcomeScreen ─────────────────────────────────────────────────────────────

function WelcomeScreen({
  produtos,
  totalModulos,
  onStart,
}: {
  produtos: DominioProduto[]
  totalModulos: number
  onStart: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center animate-in fade-in duration-300">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand-primary/10">
        <ClipboardList className="size-8 text-brand-primary" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <h2 id="dominio-modal-title" className="text-2xl font-bold text-text-primary">
          Avaliação de domínio
        </h2>
        <p className="mx-auto max-w-sm text-sm text-text-secondary">
          Avalie seu nível de conhecimento em cada módulo. Todos os campos são obrigatórios.
        </p>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-card px-3 py-1.5 text-xs text-text-secondary">
        {produtos.length} produto{produtos.length !== 1 ? "s" : ""} · {totalModulos} módulo
        {totalModulos !== 1 ? "s" : ""}
      </div>
      <Button size="lg" className="min-w-40" onClick={onStart}>
        Começar
      </Button>
    </div>
  )
}

// ─── ProductStep ───────────────────────────────────────────────────────────────

function ProductStep({
  produto,
  index,
  total,
  respostas,
  onSetEstrelas,
  onNext,
  onPrev,
  direction,
}: {
  produto: DominioProduto
  index: number
  total: number
  respostas: Record<string, Record<string, number>>
  onSetEstrelas: (produtoId: string, moduloId: string, val: number) => void
  onNext: () => void
  onPrev: () => void
  direction: Direction
}) {
  const isComplete = isProdutoComplete(produto, respostas)
  const progress = ((index + 1) / total) * 100

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", slideClass(direction))}>
      {/* Progress */}
      <div className="flex-shrink-0 px-6 pt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-text-secondary">
            Produto {index + 1} de {total}
          </span>
          <span className="text-xs font-medium tabular-nums text-text-secondary">
            {Math.round(progress)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label="Progresso da avaliação"
          className="h-1.5 w-full overflow-hidden rounded-full bg-border-default"
        >
          <div
            className="h-full rounded-full bg-brand-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4">
          <h2 id="dominio-modal-title" className="text-xl font-semibold text-text-primary">
            {produto.nome}
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">Avalie cada módulo abaixo.</p>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-card">
          <div className="flex flex-col divide-y divide-border-default">
            {produto.modulos.map((modulo) => {
              const val = respostas[produto.id]?.[modulo.id] ?? 0
              return (
                <div
                  key={modulo.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="text-sm text-text-primary">{modulo.nome}</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <StarRating
                      value={val}
                      onChange={(v) => onSetEstrelas(produto.id, modulo.id, v)}
                    />
                    {val === 0 ? (
                      <span className="text-xs text-destructive">Obrigatório</span>
                    ) : (
                      <span className="text-xs tabular-nums text-text-secondary">
                        {((val / 5) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border-default bg-muted/30 px-6 py-4">
        {!isComplete && (
          <p className="mb-2 text-xs text-text-secondary">
            Avalie todos os módulos para continuar.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={onPrev}
            aria-label={index > 0 ? "Voltar para o produto anterior" : "Voltar para a introdução"}
          >
            Anterior
          </Button>
          <Button
            onClick={onNext}
            disabled={!isComplete}
            aria-label={isComplete ? "Avançar para o próximo produto" : "Avalie todos os módulos para continuar"}
            className="sm:min-w-32"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── ReviewScreen ──────────────────────────────────────────────────────────────

function ReviewScreen({
  produtos,
  respostas,
  submitting,
  onEdit,
  onPrev,
  onConfirm,
  direction,
}: {
  produtos: DominioProduto[]
  respostas: Record<string, Record<string, number>>
  submitting: boolean
  onEdit: (index: number) => void
  onPrev: () => void
  onConfirm: () => void
  direction: Direction
}) {
  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", slideClass(direction))}>
      <div className="flex-shrink-0 px-6 pt-5">
        <h2 id="dominio-modal-title" className="text-xl font-semibold text-text-primary">
          Revisão das respostas
        </h2>
        <p className="mt-0.5 text-sm text-text-secondary">
          Confira suas respostas antes de confirmar.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {produtos.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">
            Nenhum produto configurado.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {produtos.map((produto, i) => {
              const media = calcProdutoMedia(produto, respostas)
              return (
                <div
                  key={produto.id}
                  className="rounded-xl border border-border-default bg-surface-card p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text-primary">{produto.nome}</span>
                    <div className="flex items-center gap-2">
                      {media !== null && (
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            media >= 80
                              ? "text-green-600 dark:text-green-400"
                              : media >= 50
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400",
                          )}
                        >
                          {media.toFixed(0)}%
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(i)}
                        aria-label={`Editar ${produto.nome}`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Editar
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col divide-y divide-border-default">
                    {produto.modulos.map((modulo) => {
                      const val = respostas[produto.id]?.[modulo.id] ?? 0
                      return (
                        <div
                          key={modulo.id}
                          className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                        >
                          <span className="text-sm text-text-secondary">{modulo.nome}</span>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5" aria-hidden>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={cn(
                                    "size-3.5",
                                    s <= val
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-neutral-grey-300",
                                  )}
                                />
                              ))}
                            </div>
                            <span className="w-8 text-right text-xs tabular-nums text-text-secondary">
                              {((val / 5) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border-default bg-muted/30 px-6 py-4">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onPrev} disabled={submitting}>
            Anterior
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="sm:min-w-48">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              "Confirmar avaliação"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── ConclusionScreen ──────────────────────────────────────────────────────────

function ConclusionScreen({
  resultadoPercent,
  onClose,
}: {
  resultadoPercent: number
  onClose: () => void
}) {
  const isGreat = resultadoPercent >= 80
  const isOk = resultadoPercent >= 50

  const Icon = isGreat ? CheckCircle2 : isOk ? AlertCircle : XCircle
  const iconColor = isGreat
    ? "text-green-600 dark:text-green-400"
    : isOk
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400"
  const scoreColor = isGreat
    ? "text-green-600 dark:text-green-400"
    : isOk
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400"
  const subtitle = isGreat
    ? "Excelente! Seu domínio está acima da média."
    : isOk
      ? "Bom trabalho! Há espaço para crescer."
      : "Continue estudando para melhorar seu domínio."

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center animate-in fade-in zoom-in-95 duration-300">
      <Icon className={cn("size-16", iconColor)} aria-hidden />
      <div className="flex flex-col gap-2">
        <h2 id="dominio-modal-title" className="text-2xl font-bold text-text-primary">
          Avaliação concluída!
        </h2>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border-default bg-surface-card px-10 py-5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Domínio geral
        </span>
        <span className={cn("text-5xl font-bold tabular-nums", scoreColor)}>
          {resultadoPercent.toFixed(0)}%
        </span>
      </div>
      <Button size="lg" className="min-w-40" onClick={onClose}>
        Fechar
      </Button>
    </div>
  )
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export function DominioAvaliacaoModal({ avaliacaoId, configSnapshot, onSubmit }: Props) {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)

  const produtos = React.useMemo(
    () => configSnapshot.filter((p) => p.modulos.length > 0),
    [configSnapshot],
  )
  const totalModulos = produtos.reduce((acc, p) => acc + p.modulos.length, 0)

  const [step, setStep] = React.useState<WizardStep>("welcome")
  const [direction, setDirection] = React.useState<Direction>("forward")
  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [resultadoPercent, setResultadoPercent] = React.useState<number>(0)

  // Focus first interactive element when step changes
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const first = container.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled])",
    )
    first?.focus()
  }, [step])

  // Focus trap: keep Tab cycling within the modal
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        return
      }
      if (e.key !== "Tab") return
      // container is const-narrowed above; re-check satisfies TS strict closures
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      )
      if (focusable.length === 0) { e.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    container.addEventListener("keydown", onKeyDown)
    return () => container.removeEventListener("keydown", onKeyDown)
  }, [])

  function setEstrelas(produtoId: string, moduloId: string, val: number) {
    setRespostas((prev) => ({
      ...prev,
      [produtoId]: { ...(prev[produtoId] ?? {}), [moduloId]: val },
    }))
  }

  function goTo(nextStep: WizardStep, dir: Direction) {
    setDirection(dir)
    setStep(nextStep)
  }

  function handleStart() {
    goTo(produtos.length > 0 ? 0 : "review", "forward")
  }

  function handleNext(index: number) {
    goTo(index < produtos.length - 1 ? index + 1 : "review", "forward")
  }

  function handlePrev(index: number) {
    goTo(index > 0 ? index - 1 : "welcome", "backward")
  }

  function handlePrevFromReview() {
    goTo(produtos.length > 0 ? produtos.length - 1 : "welcome", "backward")
  }

  function handleEdit(productIndex: number) {
    goTo(productIndex, "backward")
  }

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)

    const flat: DominioAvaliacaoResposta[] = []
    for (const produto of produtos) {
      for (const modulo of produto.modulos) {
        const estrelas = respostas[produto.id]?.[modulo.id]
        if (estrelas) flat.push({ produtoId: produto.id, moduloId: modulo.id, estrelas })
      }
    }

    const res = await onSubmit(avaliacaoId, flat)
    setSubmitting(false)

    if (res.error) {
      toast.error(res.error)
      return
    }

    setResultadoPercent(calcMediaGeral(produtos, respostas))
    toast.success("Avaliação de domínio concluída!")
    goTo("done", "forward")
  }

  function handleClose() {
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault()
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dominio-modal-title"
        aria-live="polite"
        aria-atomic="true"
        className="relative flex h-[95dvh] w-full flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl sm:ring-1 sm:ring-foreground/10"
      >
        {step === "welcome" && (
          <WelcomeScreen produtos={produtos} totalModulos={totalModulos} onStart={handleStart} />
        )}

        {typeof step === "number" && (
          <ProductStep
            key={step}
            produto={produtos[step]}
            index={step}
            total={produtos.length}
            respostas={respostas}
            onSetEstrelas={setEstrelas}
            onNext={() => handleNext(step)}
            onPrev={() => handlePrev(step)}
            direction={direction}
          />
        )}

        {step === "review" && (
          <ReviewScreen
            produtos={produtos}
            respostas={respostas}
            submitting={submitting}
            onEdit={handleEdit}
            onPrev={handlePrevFromReview}
            onConfirm={() => void handleConfirm()}
            direction={direction}
          />
        )}

        {step === "done" && (
          <ConclusionScreen resultadoPercent={resultadoPercent} onClose={handleClose} />
        )}
      </div>
    </div>
  )
}
