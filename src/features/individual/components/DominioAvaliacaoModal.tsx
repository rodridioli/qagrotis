"use client"

import * as React from "react"
import { Star, Trophy, PackageX, X, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  completarDominioAvaliacao,
  type DominioProduto,
  type DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
import { BadgeAchievement } from "@/features/individual/components/BadgeAchievement"
import { cn } from "@/core/utils"

interface Props {
  avaliacaoId: string
  configSnapshot: DominioProduto[]
}

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
): number | null {
  const avgs: number[] = []
  for (const p of produtos) {
    const m = calcProdutoMedia(p, respostas)
    if (m !== null) avgs.push(m)
  }
  if (avgs.length === 0) return null
  return avgs.reduce((a, b) => a + b, 0) / avgs.length
}

function isProdutoComplete(
  produto: DominioProduto,
  respostas: Record<string, Record<string, number>>,
): boolean {
  return produto.modulos.every((m) => !!respostas[produto.id]?.[m.id])
}

function playSuccessChord() {
  if (typeof window === "undefined") return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const notes = [
      { freq: 523.25, delay: 0 },
      { freq: 659.25, delay: 0.2 },
      { freq: 783.99, delay: 0.4 },
    ]
    for (const { freq, delay } of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01)
      gain.gain.setValueAtTime(0.3, t + 0.2)
      gain.gain.linearRampToValueAtTime(0, t + 0.35)
      osc.start(t)
      osc.stop(t + 0.4)
    }
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    // silently ignore — audio is enhancement only
  }
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = React.useState(0)
  const [bouncingStar, setBouncingStar] = React.useState<number | null>(null)

  function handleClick(star: number) {
    onChange(star)
    setBouncingStar(star)
    setTimeout(() => setBouncingStar(null), 350)
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
      role="group"
      aria-label="Avaliação de 1 a 5 estrelas"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        const bouncing = bouncingStar === star
        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            className={cn(
              "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
              filled ? "text-amber-400" : "text-neutral-grey-300 hover:text-amber-300",
              bouncing && "badge-hex-bounce",
            )}
          >
            <Star
              className={cn("size-6 transition-colors", filled ? "fill-current" : "")}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

type SlidePhase = "idle" | "exit-left" | "exit-right" | "enter-right" | "enter-left"

const slideClassMap: Record<SlidePhase, string> = {
  idle: "",
  "exit-left": "slide-exit-left",
  "exit-right": "slide-exit-right",
  "enter-right": "slide-enter-right",
  "enter-left": "slide-enter-left",
}

export function DominioAvaliacaoModal({ avaliacaoId, configSnapshot }: Props) {
  const router = useRouter()
  const produtos = configSnapshot.filter((p) => p.modulos.length > 0)

  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [step, setStep] = React.useState(0)
  const [displayStep, setDisplayStep] = React.useState(0)
  const [slidePhase, setSlidePhase] = React.useState<SlidePhase>("idle")
  const [showExitConfirm, setShowExitConfirm] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [exiting, setExiting] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)

  // Focus trap
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      const focusable = container!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const list = Array.from(focusable)
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    container.addEventListener("keydown", handleTab)
    return () => container.removeEventListener("keydown", handleTab)
  }, [])

  // Esc key
  React.useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.preventDefault()
      setShowExitConfirm((v) => !v)
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [])

  // Focus first star after slide completes
  React.useEffect(() => {
    if (slidePhase !== "idle") return
    if (step >= produtos.length) return
    const card = containerRef.current?.querySelector<HTMLElement>('[data-product-card]')
    card?.querySelector<HTMLButtonElement>('button[aria-label*="estrela"]')?.focus()
  }, [displayStep, slidePhase, step, produtos.length])

  // Sound on conclusion
  React.useEffect(() => {
    if (step === produtos.length && produtos.length > 0) {
      playSuccessChord()
    }
  }, [step, produtos.length])

  function navigate(direction: "next" | "prev") {
    if (slidePhase !== "idle") return
    const newStep = direction === "next" ? step + 1 : step - 1
    if (newStep < 0 || newStep > produtos.length) return

    const exitPhase: SlidePhase = direction === "next" ? "exit-left" : "exit-right"
    const enterPhase: SlidePhase = direction === "next" ? "enter-right" : "enter-left"

    setSlidePhase(exitPhase)
    setTimeout(() => {
      setDisplayStep(newStep)
      setStep(newStep)
      setSlidePhase(enterPhase)
      setTimeout(() => setSlidePhase("idle"), 260)
    }, 250)
  }

  function setEstrelas(produtoId: string, moduloId: string, val: number) {
    setRespostas((prev) => ({
      ...prev,
      [produtoId]: { ...(prev[produtoId] ?? {}), [moduloId]: val },
    }))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    const flat: DominioAvaliacaoResposta[] = []
    for (const produto of produtos) {
      for (const modulo of produto.modulos) {
        const estrelas = respostas[produto.id]?.[modulo.id]
        if (estrelas) flat.push({ produtoId: produto.id, moduloId: modulo.id, estrelas })
      }
    }
    const res = await completarDominioAvaliacao(avaliacaoId, flat)
    setSubmitting(false)
    if (res.error) {
      toast.error("Não foi possível salvar. Tente novamente.")
      return
    }
    toast.success("Avaliação salva com sucesso!")
    setExiting(true)
    setTimeout(() => router.refresh(), 250)
  }

  function handleExit() {
    setExiting(true)
    setTimeout(() => router.refresh(), 250)
  }

  const isConclusion = step === produtos.length && produtos.length > 0
  const isEmpty = produtos.length === 0
  const currentProduto = produtos[displayStep]
  const produtosConcluidoCount = produtos.filter((p) => isProdutoComplete(p, respostas)).length
  const progressPercent = produtos.length > 0 ? (produtosConcluidoCount / produtos.length) * 100 : 0
  const currentComplete = currentProduto ? isProdutoComplete(currentProduto, respostas) : false
  const isLastProduct = displayStep === produtos.length - 1
  const mediaGeral = calcMediaGeral(produtos, respostas)

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Avaliação de domínio"
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col bg-background",
        exiting
          ? "animate-out fade-out zoom-out-[0.97] duration-200 fill-mode-forwards"
          : "animate-in fade-in zoom-in-[0.97] duration-300 fill-mode-forwards",
      )}
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default px-4 sm:px-6">
        <span className="text-sm font-semibold text-text-primary">QAgrotis</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Sair da avaliação"
          onClick={() => setShowExitConfirm(true)}
        >
          <X className="size-4" aria-hidden />
          <span className="ml-1.5 hidden sm:inline">Sair</span>
        </Button>
      </header>

      {/* Progress bar */}
      {!isEmpty && (
        <div
          className="h-[5px] w-full shrink-0 bg-muted/40"
          role="progressbar"
          aria-valuenow={isConclusion ? produtos.length : step + 1}
          aria-valuemin={1}
          aria-valuemax={produtos.length}
          aria-label={`Produto ${isConclusion ? produtos.length : step + 1} de ${produtos.length}`}
        >
          <div
            className="h-full bg-primary-700 transition-all duration-500 ease-in-out"
            style={{ width: `${isConclusion ? 100 : progressPercent}%` }}
          />
        </div>
      )}

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <PackageX className="size-12 text-text-secondary" aria-hidden />
            <p className="text-sm text-text-secondary">
              Nenhum produto configurado para avaliação.
            </p>
          </div>
        ) : isConclusion ? (
          <ConclusionScreen
            produtos={produtos}
            respostas={respostas}
            mediaGeral={mediaGeral}
          />
        ) : (
          <div className="flex w-full max-w-2xl flex-col gap-4">
            {/* Step indicator */}
            <div className="text-center" aria-live="polite">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Produto {displayStep + 1} de {produtos.length}
              </p>
              <h1 className="mt-1 text-xl font-bold text-text-primary sm:text-2xl">
                {currentProduto?.nome ?? ""}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Avalie cada módulo de 1 a 5 estrelas
              </p>
            </div>

            {/* Product card */}
            <div
              data-product-card
              className={cn(
                "w-full rounded-2xl border border-border-default bg-surface-card p-4 shadow-card sm:p-6",
                slideClassMap[slidePhase],
              )}
            >
              <div className="flex flex-col divide-y divide-border-default">
                {currentProduto?.modulos.map((modulo) => {
                  const val = respostas[currentProduto.id]?.[modulo.id] ?? 0
                  return (
                    <div
                      key={modulo.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-sm text-text-primary">{modulo.nome}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <StarRating
                          value={val}
                          onChange={(v) => setEstrelas(currentProduto.id, modulo.id, v)}
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

              {/* Product average */}
              {currentProduto && (
                <div className="mt-4 flex items-center justify-between border-t border-border-default pt-3">
                  <span className="text-xs text-text-secondary">Média do produto</span>
                  {(() => {
                    const media = calcProdutoMedia(currentProduto, respostas)
                    return media !== null ? (
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          media >= 80
                            ? "text-badge-success"
                            : media >= 50
                              ? "text-amber-500 dark:text-amber-400"
                              : "text-destructive",
                        )}
                      >
                        {media.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-sm italic text-text-secondary">—</span>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border-default bg-muted/30 px-4 py-4 sm:px-6">
        {isEmpty ? (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setShowExitConfirm(true)}>
              Fechar
            </Button>
          </div>
        ) : isConclusion ? (
          <Button
            className="w-full"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? "Salvando…" : "Confirmar e salvar"}
          </Button>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {displayStep > 0 ? (
              <Button
                variant="ghost"
                onClick={() => navigate("prev")}
                disabled={slidePhase !== "idle"}
                aria-label="Ir para produto anterior"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Anterior
              </Button>
            ) : (
              <div />
            )}
            <Button
              onClick={() => navigate("next")}
              disabled={!currentComplete || slidePhase !== "idle"}
              aria-label={isLastProduct ? "Ver resumo da avaliação" : "Ir para próximo produto"}
            >
              {isLastProduct ? "Ver resumo" : "Próximo"}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </footer>

      {/* Exit confirm dialog */}
      {showExitConfirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
          aria-live="assertive"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-dialog-title"
            className="mx-4 w-full max-w-sm rounded-xl bg-background p-6 shadow-card"
          >
            <h2 id="exit-dialog-title" className="text-base font-semibold text-text-primary">
              Sair da avaliação?
            </h2>
            <p className="mt-1 text-sm text-text-secondary">Seu progresso não será salvo.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                variant="ghost"
                onClick={() => setShowExitConfirm(false)}
              >
                Continuar avaliação
              </Button>
              <Button variant="destructive" onClick={handleExit}>
                Sair mesmo assim
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConclusionScreen({
  produtos,
  respostas,
  mediaGeral,
}: {
  produtos: DominioProduto[]
  respostas: Record<string, Record<string, number>>
  mediaGeral: number | null
}) {
  return (
    <div className="flex w-full max-w-2xl animate-in fade-in zoom-in-95 flex-col items-center gap-6 duration-300">
      <BadgeAchievement
        label="Domínio"
        icon={Trophy}
        color="var(--qagrotis-primary-700)"
        unlocked
        autoAnimate
        description="Avaliação de domínio concluída"
      />

      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">Avaliação concluída!</h2>
        <p className="mt-1 text-sm text-text-secondary">Domínio geral</p>
        <p className="mt-1 text-5xl font-bold tabular-nums text-primary-700">
          {mediaGeral !== null ? `${mediaGeral.toFixed(0)}%` : "—"}
        </p>
      </div>

      <div className="w-full rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Resumo por produto
        </h3>
        <div className="flex flex-col gap-2">
          {produtos.map((produto) => {
            const media = calcProdutoMedia(produto, respostas)
            return (
              <div key={produto.id} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {produto.nome}
                </span>
                <span
                  className="shrink-0 flex-1 border-b border-dashed border-border-default"
                  aria-hidden
                />
                <span
                  className={cn(
                    "w-10 shrink-0 text-right text-sm font-semibold tabular-nums",
                    media === null
                      ? "text-text-secondary"
                      : media >= 80
                        ? "text-badge-success"
                        : media >= 50
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-destructive",
                  )}
                >
                  {media !== null ? `${media.toFixed(0)}%` : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
