"use client"

import * as React from "react"
import {
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  PackageX,
  ClipboardList,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Target,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type {
  DominioProduto,
  DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  avaliacaoId: string
  configSnapshot: DominioProduto[]
  onSubmit: (id: string, respostas: DominioAvaliacaoResposta[]) => Promise<{ error?: string }>
}

// step: "intro" | 0..N-1 (product index) | "review" | "done"
type WizardStep = "intro" | number | "review" | "done"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseModulo(nome: string): { code: string | null; label: string } {
  const match = /^([A-Z0-9]{2,6})\s*[-–]\s*(.+)$/.exec(nome)
  if (match) return { code: match[1]!, label: match[2]! }
  return { code: null, label: nome }
}

const NIVEL_LABELS: Record<number, string> = {
  1: "Iniciante",
  2: "Básico",
  3: "Intermediário",
  4: "Avançado",
  5: "Especialista",
}

const CODE_COLORS: string[] = [
  "text-emerald-700 bg-emerald-50",
  "text-blue-700 bg-blue-50",
  "text-violet-700 bg-violet-50",
  "text-amber-700 bg-amber-50",
  "text-rose-700 bg-rose-50",
  "text-cyan-700 bg-cyan-50",
]

function codeColor(index: number): string {
  return CODE_COLORS[index % CODE_COLORS.length]!
}

function calcProdutoMedia(
  produto: DominioProduto,
  respostas: Record<string, Record<string, number>>,
): number | null {
  const scores: number[] = []
  for (const m of produto.modulos) {
    const v = respostas[produto.id]?.[m.id]
    if (v) scores.push(v)
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

function countAvaliadosTotal(
  produtos: DominioProduto[],
  respostas: Record<string, Record<string, number>>,
): number {
  return produtos.reduce(
    (acc, p) => acc + p.modulos.filter((m) => !!respostas[p.id]?.[m.id]).length,
    0,
  )
}

function playSuccessChord() {
  if (typeof window === "undefined") return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    for (const { freq, delay } of [
      { freq: 523.25, delay: 0 },
      { freq: 659.25, delay: 0.2 },
      { freq: 783.99, delay: 0.4 },
    ]) {
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
    // audio is enhancement only
  }
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = React.useState(0)
  const [bouncing, setBouncing] = React.useState<number | null>(null)

  function handleClick(star: number) {
    onChange(star)
    setBouncing(star)
    setTimeout(() => setBouncing(null), 350)
  }

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
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHovered(star)}
            className={cn(
              "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
              filled ? "text-amber-400" : "text-neutral-grey-300 hover:text-amber-300",
              bouncing === star && "badge-hex-bounce",
            )}
          >
            <Star className={cn("size-5 transition-colors", filled && "fill-current")} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

// ─── HorizontalStepper ───────────────────────────────────────────────────────

function HorizontalStepper({
  produtos,
  step,
  onClickStep,
}: {
  produtos: DominioProduto[]
  step: WizardStep
  onClickStep?: (s: WizardStep) => void
}) {
  // steps: intro (0), products (1..N), review (N+1)
  const steps: { label: string; key: WizardStep }[] = [
    { label: "Introdução", key: "intro" },
    ...produtos.map((p, i) => ({ label: p.nome, key: i as WizardStep })),
    { label: "Revisão", key: "review" },
  ]

  function stepIndex(s: WizardStep): number {
    if (s === "intro") return 0
    if (s === "review") return produtos.length + 1
    if (s === "done") return produtos.length + 1
    return (s as number) + 1
  }

  const activeIdx = stepIndex(step)

  return (
    <nav
      aria-label="Etapas da avaliação"
      className="flex items-center gap-0 overflow-x-auto border-b border-border-default bg-background px-4 py-3 sm:px-6"
    >
      {steps.map((s, i) => {
        const sIdx = stepIndex(s.key)
        const isActive = sIdx === activeIdx
        const isDone = sIdx < activeIdx && step !== "done"
        const isLast = i === steps.length - 1

        return (
          <React.Fragment key={String(s.key)}>
            <div className="flex shrink-0 items-center gap-1.5">
              {isDone ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-primary">
                  <Check className="size-3.5 text-white" aria-hidden />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    isActive
                      ? "bg-brand-primary text-white"
                      : "bg-muted text-text-secondary",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  isActive ? "text-text-primary" : isDone ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-2 h-px min-w-[24px] flex-1",
                  sIdx < activeIdx ? "bg-brand-primary" : "bg-border-default",
                )}
                aria-hidden
              />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ─── IntroScreen ──────────────────────────────────────────────────────────────

function IntroScreen({
  produtos,
  totalModulos,
  onStart,
}: {
  produtos: DominioProduto[]
  totalModulos: number
  onStart: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center animate-in fade-in duration-300">
      {produtos.length === 0 ? (
        <PackageX className="size-12 text-text-secondary" aria-hidden />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-full bg-brand-primary/10">
          <ClipboardList className="size-8 text-brand-primary" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h2 id="avaliacao-title" className="text-2xl font-bold text-text-primary">
          Avaliação de domínio técnico
        </h2>
        <p className="mx-auto max-w-md text-sm text-text-secondary">
          {produtos.length === 0
            ? "Nenhum produto configurado para avaliação."
            : "Avalie seu nível de conhecimento em cada módulo usando a escala de 1 a 5 estrelas. Todos os campos são obrigatórios antes de enviar."}
        </p>
      </div>
      {produtos.length > 0 && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-card px-3 py-1.5 text-xs text-text-secondary">
            {produtos.length} etapa{produtos.length !== 1 ? "s" : ""}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-card px-3 py-1.5 text-xs text-text-secondary">
            {totalModulos} módulo{totalModulos !== 1 ? "s" : ""}
          </div>
        </div>
      )}
      <Button size="lg" className="min-w-44" onClick={onStart} disabled={produtos.length === 0}>
        Começar avaliação
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  )
}

// ─── ProductStep ──────────────────────────────────────────────────────────────

function ProductStep({
  produto,
  produtoIndex,
  respostas,
  onSetEstrelas,
  onNext,
  onPrev,
}: {
  produto: DominioProduto
  produtoIndex: number
  respostas: Record<string, Record<string, number>>
  onSetEstrelas: (produtoId: string, moduloId: string, val: number) => void
  onNext: () => void
  onPrev: () => void
}) {
  const isComplete = isProdutoComplete(produto, respostas)
  const avaliados = produto.modulos.filter((m) => !!respostas[produto.id]?.[m.id]).length
  const total = produto.modulos.length
  const media = calcProdutoMedia(produto, respostas)

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          {/* Module evaluation table */}
          <div className="rounded-xl border border-border-default bg-background">
            <div className="border-b border-border-default px-5 py-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Avalie seu domínio nos módulos
              </h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                Clique nas estrelas para atribuir uma nota de 1 a 5.
              </p>
            </div>

            {/* Table header */}
            <div className="hidden grid-cols-[80px_1fr_180px_120px] border-b border-border-default px-5 py-2.5 sm:grid">
              {["CÓDIGO", "MÓDULO", "AVALIAÇÃO", "NÍVEL"].map((col) => (
                <span key={col} className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {col}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-border-default">
              {produto.modulos.map((modulo, mIdx) => {
                const { code, label } = parseModulo(modulo.nome)
                const val = respostas[produto.id]?.[modulo.id] ?? 0
                const nivel = NIVEL_LABELS[val]

                return (
                  <div
                    key={modulo.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:grid sm:grid-cols-[80px_1fr_180px_120px] sm:items-center sm:gap-4"
                  >
                    {/* Código */}
                    <div>
                      {code ? (
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide",
                            codeColor(produtoIndex * 10 + mIdx),
                          )}
                        >
                          {code}
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary">—</span>
                      )}
                    </div>
                    {/* Módulo */}
                    <div>
                      <p className="text-sm font-medium text-text-primary">{label}</p>
                    </div>
                    {/* Avaliação */}
                    <div>
                      <StarRating value={val} onChange={(v) => onSetEstrelas(produto.id, modulo.id, v)} />
                    </div>
                    {/* Nível */}
                    <div>
                      {val > 0 ? (
                        <span className="text-sm font-semibold text-text-primary">{nivel}</span>
                      ) : (
                        <span className="text-xs text-destructive">Obrigatório</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom summary */}
            <div className="flex flex-col gap-3 border-t border-border-default bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg text-sm font-bold",
                    media !== null ? "bg-brand-primary/10 text-brand-primary" : "bg-muted text-text-secondary",
                  )}
                >
                  {media !== null ? media.toFixed(1) : "—"}
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">Média desta etapa</p>
                  <p className="text-xs text-text-secondary">
                    {avaliados} de {total} módulo{total !== 1 ? "s" : ""} avaliado{avaliados !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:w-48">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-default">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-[width] duration-300"
                    style={{ width: `${(avaliados / total) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-text-secondary">
                  {Math.round((avaliados / total) * 100)}% concluído
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="shrink-0 border-t border-border-default bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <p className="text-xs text-text-secondary">
            {isComplete ? (
              <span className="font-medium text-badge-success">Etapa completa. Avance para a próxima.</span>
            ) : (
              `Avalie todos os ${total} módulos para continuar.`
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrev}>
              <ChevronLeft className="size-4" aria-hidden />
              Voltar
            </Button>
            <Button size="sm" onClick={onNext} disabled={!isComplete} className="gap-1.5">
              Próxima etapa
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ReviewScreen ─────────────────────────────────────────────────────────────

function ReviewScreen({
  produtos,
  respostas,
  submitting,
  onEdit,
  onPrev,
  onConfirm,
}: {
  produtos: DominioProduto[]
  respostas: Record<string, Record<string, number>>
  submitting: boolean
  onEdit: (index: number) => void
  onPrev: () => void
  onConfirm: () => void
}) {
  const totalModulos = produtos.reduce((a, p) => a + p.modulos.length, 0)
  const totalAvaliados = countAvaliadosTotal(produtos, respostas)
  const etapasConcluidas = produtos.filter((p) => isProdutoComplete(p, respostas)).length
  const pendentes = totalModulos - totalAvaliados
  const mediaGeral = calcMediaGeral(produtos, respostas)

  const stats = [
    {
      label: "Domínio geral",
      value: mediaGeral > 0 ? mediaGeral.toFixed(2) + "/5" : "—",
      sub: mediaGeral >= 4 ? "Excelente" : mediaGeral >= 3 ? "Bom" : mediaGeral >= 2 ? "Regular" : "—",
      icon: Target,
      color: "text-brand-primary bg-brand-primary/10",
    },
    {
      label: "Módulos avaliados",
      value: `${totalAvaliados}`,
      sub: `${totalAvaliados}/${totalModulos}  ·  ${totalAvaliados === totalModulos ? "100% concluído" : `${Math.round((totalAvaliados / totalModulos) * 100)}% concluído`}`,
      icon: Check,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Etapas cobertas",
      value: `${etapasConcluidas}`,
      sub: `${etapasConcluidas}/${produtos.length}  ·  Etapas com 100% de avaliação`,
      icon: Layers,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Pendentes",
      value: `${pendentes}`,
      sub: pendentes === 0 ? "Pronto para envio" : `${pendentes} módulo${pendentes !== 1 ? "s" : ""} sem avaliação`,
      icon: pendentes === 0 ? CheckCircle2 : AlertTriangle,
      color: pendentes === 0 ? "text-badge-success bg-badge-success/10" : "text-amber-600 bg-amber-50",
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          {/* Stat cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="rounded-xl border border-border-default bg-background p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-text-secondary">{s.label}</p>
                      <p className="mt-1 text-2xl font-bold text-text-primary">{s.value}</p>
                    </div>
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", s.color)}>
                      <Icon className="size-4" aria-hidden />
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{s.sub}</p>
                </div>
              )
            })}
          </div>

          {/* Per-product sections */}
          {produtos.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">Nenhum produto configurado.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {produtos.map((produto, pIdx) => {
                const media = calcProdutoMedia(produto, respostas)
                const avaliados = produto.modulos.filter((m) => !!respostas[produto.id]?.[m.id]).length

                return (
                  <div key={produto.id} className="rounded-xl border border-border-default bg-background">
                    <div className="flex items-center justify-between gap-2 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{produto.nome}</p>
                        <p className="text-xs text-text-secondary">
                          Média: {media !== null ? media.toFixed(2) : "—"} · {avaliados}/{produto.modulos.length} avaliados
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => onEdit(pIdx)}>
                        Editar
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 border-t border-border-default px-5 py-4 sm:grid-cols-2">
                      {produto.modulos.map((modulo, mIdx) => {
                        const { code, label } = parseModulo(modulo.nome)
                        const val = respostas[produto.id]?.[modulo.id] ?? 0
                        const nivel = NIVEL_LABELS[val]

                        return (
                          <div
                            key={modulo.id}
                            className="flex items-center gap-3 rounded-lg border border-border-default p-3"
                          >
                            <div
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold",
                                val > 0
                                  ? "bg-brand-primary/10 text-brand-primary"
                                  : "bg-muted text-text-secondary",
                              )}
                            >
                              {val > 0 ? val : "—"}
                            </div>
                            <div className="min-w-0 flex-1">
                              {code && (
                                <span
                                  className={cn(
                                    "mb-0.5 inline-block rounded px-1 py-0.5 text-[10px] font-bold tracking-wide",
                                    codeColor(pIdx * 10 + mIdx),
                                  )}
                                >
                                  {code}
                                </span>
                              )}
                              <p className="truncate text-xs font-medium text-text-primary">{label}</p>
                              <div className="mt-0.5 flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={cn(
                                      "size-3",
                                      s <= val ? "fill-amber-400 text-amber-400" : "text-neutral-grey-300",
                                    )}
                                    aria-hidden
                                  />
                                ))}
                                {nivel && (
                                  <span className="ml-1 text-[11px] text-text-secondary">{nivel}</span>
                                )}
                              </div>
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
      </div>

      {/* Sticky bottom bar */}
      <div className="shrink-0 border-t border-border-default bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <p className="text-xs text-text-secondary">
            {pendentes === 0 ? (
              <span className="font-medium text-badge-success">Tudo pronto. Envie sua avaliação.</span>
            ) : (
              <span className="text-amber-600">{pendentes} módulo{pendentes !== 1 ? "s" : ""} pendente{pendentes !== 1 ? "s" : ""}.</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrev} disabled={submitting}>
              <ChevronLeft className="size-4" aria-hidden />
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={submitting || pendentes > 0}
              className="gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                <>
                  Enviar avaliação
                  <ChevronRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SuccessScreen ────────────────────────────────────────────────────────────

function SuccessScreen({
  mediaGeral,
  onRedo,
  onClose,
}: {
  mediaGeral: number
  onRedo: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-full max-w-lg rounded-2xl border border-border-default bg-background p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-brand-primary/10">
          <Check className="size-8 text-brand-primary" aria-hidden />
        </div>
        <h2 id="avaliacao-title" className="text-xl font-bold text-text-primary">
          Avaliação enviada com sucesso
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Obrigado por completar a avaliação. Seu domínio geral foi de{" "}
          <strong>{mediaGeral.toFixed(2)}/5</strong>.
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Você pode revisar suas respostas a qualquer momento dentro de{" "}
          <strong>Individual › Avaliações</strong>.
        </p>
        <div className="mt-7 flex flex-col-reverse items-center gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onRedo}>
            <ChevronLeft className="size-4" aria-hidden />
            Refazer avaliação
          </Button>
          <Button onClick={onClose}>
            Ir para o Painel
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DominioAvaliacaoModal({ avaliacaoId, configSnapshot, onSubmit }: Props) {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)

  const produtos = React.useMemo(
    () => configSnapshot.filter((p) => p.modulos.length > 0),
    [configSnapshot],
  )
  const totalModulos = produtos.reduce((acc, p) => acc + p.modulos.length, 0)

  const [step, setStep] = React.useState<WizardStep>("intro")
  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [mediaGeral, setMediaGeral] = React.useState(0)
  const [showExitConfirm, setShowExitConfirm] = React.useState(false)
  const [exiting, setExiting] = React.useState(false)

  // Auto-focus first interactive element on step change
  React.useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled])",
    )
    el?.focus()
  }, [step])

  // Focus trap + Escape
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        if (step !== "done") setShowExitConfirm((v) => !v)
        return
      }
      if (e.key !== "Tab") return
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      )
      if (focusable.length === 0) { e.preventDefault(); return }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    container.addEventListener("keydown", onKeyDown)
    return () => container.removeEventListener("keydown", onKeyDown)
  }, [step])

  function setEstrelas(produtoId: string, moduloId: string, val: number) {
    setRespostas((prev) => ({
      ...prev,
      [produtoId]: { ...(prev[produtoId] ?? {}), [moduloId]: val },
    }))
  }

  function handleStart() {
    setStep(produtos.length > 0 ? 0 : "review")
  }

  function handleNext(index: number) {
    setStep(index < produtos.length - 1 ? index + 1 : "review")
  }

  function handlePrev(index: number) {
    setStep(index > 0 ? index - 1 : "intro")
  }

  function handleEdit(productIndex: number) {
    setStep(productIndex)
  }

  function handleRedo() {
    setRespostas({})
    setStep("intro")
  }

  function handleExit() {
    setExiting(true)
    setTimeout(() => router.refresh(), 250)
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

    setMediaGeral(calcMediaGeral(produtos, respostas))
    playSuccessChord()
    setStep("done")
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avaliacao-title"
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col bg-background",
        exiting
          ? "animate-out fade-out zoom-out-[0.97] duration-200 fill-mode-forwards"
          : "animate-in fade-in zoom-in-[0.97] duration-300 fill-mode-forwards",
      )}
    >
      {/* App-like header */}
      {step !== "done" && (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-background px-4 sm:px-6">
          <span className="text-sm font-semibold text-text-primary">Avaliação de Domínio</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Sair da avaliação"
            onClick={() => setShowExitConfirm(true)}
          >
            <X className="size-4" aria-hidden />
            <span className="ml-1 hidden sm:inline">Sair</span>
          </Button>
        </header>
      )}

      {/* Stepper (hidden on intro + done) */}
      {step !== "intro" && step !== "done" && (
        <HorizontalStepper produtos={produtos} step={step} />
      )}

      {/* Main content */}
      {step === "intro" && (
        <IntroScreen produtos={produtos} totalModulos={totalModulos} onStart={handleStart} />
      )}

      {typeof step === "number" && produtos[step] && (
        <ProductStep
          key={step}
          produto={produtos[step]}
          produtoIndex={step}
          respostas={respostas}
          onSetEstrelas={setEstrelas}
          onNext={() => handleNext(step)}
          onPrev={() => handlePrev(step)}
        />
      )}

      {step === "review" && (
        <ReviewScreen
          produtos={produtos}
          respostas={respostas}
          submitting={submitting}
          onEdit={handleEdit}
          onPrev={() => setStep(produtos.length > 0 ? produtos.length - 1 : "intro")}
          onConfirm={() => void handleConfirm()}
        />
      )}

      {step === "done" && (
        <SuccessScreen
          mediaGeral={mediaGeral}
          onRedo={handleRedo}
          onClose={handleExit}
        />
      )}

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
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <Button autoFocus variant="ghost" onClick={() => setShowExitConfirm(false)}>
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
