"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Star, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
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

type Step = number | "done"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseModulo(nome: string): { code: string | null; label: string } {
  if (/^Core\s*\/\s*ACC$/i.test(nome.trim())) return { code: "CORE", label: "ACC" }
  const m = /^([A-Z0-9]{2,6})\s*[-–]\s*(.+)$/.exec(nome)
  if (m) return { code: m[1]!, label: m[2]! }
  return { code: null, label: nome }
}

const NIVEL = ["Sem nota", "Iniciante", "Básico", "Intermediário", "Avançado", "Especialista"]

function produtoAvg(p: DominioProduto, r: Record<string, Record<string, number>>): number {
  const vals = p.modulos.map(m => r[p.id]?.[m.id] ?? 0).filter(Boolean)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function globalAvg(ps: DominioProduto[], r: Record<string, Record<string, number>>): number {
  const vals: number[] = []
  for (const p of ps) for (const m of p.modulos) { const v = r[p.id]?.[m.id]; if (v) vals.push(v) }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function isProdutoDone(p: DominioProduto, r: Record<string, Record<string, number>>) {
  return p.modulos.every(m => !!r[p.id]?.[m.id])
}

function playSuccessChord() {
  if (typeof window === "undefined") return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  try {
    const AudioCtx = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    for (const { freq, delay } of [{ freq: 523.25, delay: 0 }, { freq: 659.25, delay: 0.2 }, { freq: 783.99, delay: 0.4 }]) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = "sine"; osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01)
      gain.gain.setValueAtTime(0.3, t + 0.2)
      gain.gain.linearRampToValueAtTime(0, t + 0.35)
      osc.start(t); osc.stop(t + 0.4)
    }
    setTimeout(() => void ctx.close(), 1200)
  } catch { /* audio is enhancement only */ }
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ value, onChange, name }: { value: number; onChange: (v: number) => void; name: string }) {
  const [hover, setHover] = React.useState(0)
  const display = hover || value

  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={`Avalie ${name}`}>
      {[1, 2, 3, 4, 5].map(i => {
        const lit = display >= i
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(i)}
            className={cn(
              "flex size-7 items-center justify-center rounded transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
              lit ? "text-amber-400" : "text-neutral-grey-300"
            )}
          >
            <Star className="size-5" fill={lit ? "currentColor" : "none"} strokeWidth={1.5} />
          </button>
        )
      })}
    </div>
  )
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({
  produtos,
  step,
  onClickStep,
}: {
  produtos: DominioProduto[]
  step: Step
  onClickStep: (s: number) => void
}) {
  const reviewStep = produtos.length + 1
  const activeIdx = step === "done" ? reviewStep : (step as number)
  const total = produtos.length + 2 // intro + produtos + review

  const steps = [
    { label: "Introdução", idx: 0 },
    ...produtos.map((p, i) => ({ label: p.nome, idx: i + 1 })),
    { label: "Revisão", idx: reviewStep },
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {steps.map((s, i) => {
        const isDone = s.idx < activeIdx
        const isActive = s.idx === activeIdx
        return (
          <React.Fragment key={s.idx}>
            <button
              type="button"
              onClick={() => onClickStep(s.idx)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-brand-primary text-white"
                  : isDone
                  ? "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <span className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                isActive ? "bg-white/20" : isDone ? "bg-brand-primary/20" : "bg-neutral-grey-200"
              )}>
                {isDone ? "✓" : String(i + 1)}
              </span>
              <span className="max-w-[80px] truncate">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn(
                "h-px w-3 shrink-0",
                s.idx < activeIdx ? "bg-brand-primary/40" : "bg-border-default"
              )} />
            )}
          </React.Fragment>
        )
      })}
      <span className="ml-auto shrink-0 text-xs text-text-muted">
        {step !== "done" && `${(step as number) + 1} / ${total}`}
      </span>
    </div>
  )
}

// ─── IntroPane ────────────────────────────────────────────────────────────────

function IntroPane({ produtos, totalModulos }: { produtos: DominioProduto[]; totalModulos: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-4">
        <p className="text-sm font-medium text-brand-primary">Avaliação ativa</p>
        <h2 className="mt-1 text-lg font-bold text-text-primary leading-snug">
          Avalie seu domínio técnico em cada módulo do sistema.
        </h2>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
          Atribua uma nota de 1 a 5 estrelas por módulo. Todos os itens são obrigatórios.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Etapas",           value: String(produtos.length) },
          { label: "Itens p/ avaliar", value: String(totalModulos) },
          { label: "Escala",           value: "1 – 5 ★" },
          { label: "Tempo médio",      value: "4 min" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border-default bg-surface-card px-4 py-3">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-green-700 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Salvamento automático ativo
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" />
          Todos os itens são obrigatórios
        </div>
      </div>
    </div>
  )
}

// ─── RatePane ─────────────────────────────────────────────────────────────────

function RatePane({
  produto,
  produtoIdx,
  totalProdutos,
  respostas,
  onSetEstrelas,
}: {
  produto: DominioProduto
  produtoIdx: number
  totalProdutos: number
  respostas: Record<string, Record<string, number>>
  onSetEstrelas: (pid: string, mid: string, v: number) => void
}) {
  const vals = produto.modulos.map(m => respostas[produto.id]?.[m.id] ?? 0).filter(Boolean)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const rated = produto.modulos.filter(m => !!respostas[produto.id]?.[m.id]).length
  const pct = produto.modulos.length > 0 ? rated / produto.modulos.length : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho da etapa */}
      <div className="rounded-xl border border-border-default bg-surface-card px-4 py-3">
        <p className="text-xs text-text-muted">Etapa {String(produtoIdx).padStart(2, "0")} de {String(totalProdutos).padStart(2, "0")}</p>
        <p className="mt-0.5 text-base font-semibold text-text-primary">{produto.nome}</p>
        <p className="mt-1 text-xs text-text-secondary">Clique nas estrelas para atribuir uma nota de 1 a 5.</p>
      </div>

      {/* Tabela de módulos */}
      <div className="overflow-hidden rounded-xl border border-border-default">
        <div className="grid grid-cols-[auto_1fr_auto] border-b border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Cód.</div>
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Módulo</div>
          <div className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Avaliação</div>
        </div>
        {produto.modulos.map((modulo, mIdx) => {
          const { code, label } = parseModulo(modulo.nome)
          const v = respostas[produto.id]?.[modulo.id] ?? 0
          return (
            <div
              key={modulo.id}
              className={cn(
                "grid grid-cols-[auto_1fr_auto] items-center",
                mIdx < produto.modulos.length - 1 && "border-b border-border-default"
              )}
            >
              <div className="px-3 py-3 font-mono text-xs font-semibold text-brand-primary">
                {code ?? "—"}
              </div>
              <div className="min-w-0 px-3 py-3">
                <p className="truncate text-sm font-medium text-text-primary">{label}</p>
                {v > 0 && (
                  <p className="text-xs text-text-muted">{NIVEL[v]}</p>
                )}
              </div>
              <div className="px-3 py-3">
                <Stars
                  value={v}
                  onChange={val => onSetEstrelas(produto.id, modulo.id, val)}
                  name={label}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumo da etapa */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-card px-4 py-3">
        <div>
          <p className="text-xs text-text-muted">Média desta etapa</p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">
            {rated} de {produto.modulos.length} módulos avaliados
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-text-primary">
            {avg ? avg.toFixed(1) : "—"}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-grey-200">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ReviewPane ───────────────────────────────────────────────────────────────

function ReviewPane({
  produtos,
  respostas,
  submitting,
  onEdit,
  onConfirm,
}: {
  produtos: DominioProduto[]
  respostas: Record<string, Record<string, number>>
  submitting: boolean
  onEdit: (idx: number) => void
  onConfirm: () => void
}) {
  const overall = globalAvg(produtos, respostas)
  const allModulos = produtos.flatMap(p => p.modulos)
  const done = allModulos.filter(m => {
    const p = produtos.find(p => p.modulos.some(mm => mm.id === m.id))
    return p ? !!respostas[p.id]?.[m.id] : false
  }).length
  const missing = allModulos.length - done
  const allDone = missing === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo geral */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border-default bg-surface-card px-4 py-3">
          <p className="text-xs text-text-muted">Domínio geral</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
            {overall ? overall.toFixed(2) : "—"}<span className="ml-1 text-sm font-normal text-text-muted">/5</span>
          </p>
        </div>
        <div className={cn(
          "rounded-xl border px-4 py-3",
          allDone
            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
            : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
        )}>
          <p className="text-xs text-text-muted">Pendentes</p>
          <p className={cn(
            "mt-1 text-2xl font-bold tabular-nums",
            allDone ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
          )}>
            {missing}
          </p>
          <p className="text-xs text-text-muted">
            {allDone ? "Pronto para envio" : "itens sem nota"}
          </p>
        </div>
      </div>

      {/* Por produto */}
      <div className="flex flex-col gap-2">
        {produtos.map((produto, pIdx) => {
          const avg = produtoAvg(produto, respostas)
          const rated = produto.modulos.filter(m => !!respostas[produto.id]?.[m.id]).length
          const complete = isProdutoDone(produto, respostas)
          return (
            <div
              key={produto.id}
              className="overflow-hidden rounded-xl border border-border-default bg-surface-card"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">{produto.nome}</p>
                    {complete ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {avg ? avg.toFixed(2) : "—"} · {rated}/{produto.modulos.length} avaliados
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(pIdx + 1)}
                >
                  Editar
                </Button>
              </div>
              {produto.modulos.length > 0 && (
                <div className="border-t border-border-default px-4 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {produto.modulos.map(modulo => {
                      const { code } = parseModulo(modulo.nome)
                      const v = respostas[produto.id]?.[modulo.id] ?? 0
                      return (
                        <span
                          key={modulo.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                            v > 0
                              ? "bg-brand-primary/10 text-brand-primary"
                              : "bg-neutral-grey-100 text-text-muted"
                          )}
                        >
                          {code ?? modulo.nome}
                          {v > 0 && <span className="text-amber-500">{"★".repeat(v)}</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allDone && (
        <Button
          onClick={onConfirm}
          disabled={submitting}
          className="w-full"
        >
          {submitting ? "Enviando…" : "Enviar avaliação"}
          {!submitting && <ChevronRight className="size-4" />}
        </Button>
      )}
    </div>
  )
}

// ─── DonePane ─────────────────────────────────────────────────────────────────

function DonePane({ overall, onClose }: { overall: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
        <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-text-primary">Avaliação enviada com sucesso</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Domínio geral: <strong>{overall.toFixed(2)}/5</strong>
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Você pode revisar suas respostas a qualquer momento em <strong>Individual › Domínio</strong>.
        </p>
      </div>
      <Button onClick={onClose} className="mt-2">
        Fechar
      </Button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DominioAvaliacaoModal({ avaliacaoId, configSnapshot, onSubmit }: Props) {
  const router = useRouter()
  const produtos = React.useMemo(() => configSnapshot.filter(p => p.modulos.length > 0), [configSnapshot])
  const totalModulos = produtos.reduce((a, p) => a + p.modulos.length, 0)
  const reviewStep = produtos.length + 1

  const [open, setOpen] = React.useState(true)
  const [step, setStep] = React.useState<Step>(0)
  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [overall, setOverall] = React.useState(0)

  function handleOpenChange(next: boolean) {
    if (!next && step !== "done") return
    if (!next) {
      setOpen(false)
      router.refresh()
    }
  }

  function setEstrelas(pid: string, mid: string, v: number) {
    setRespostas(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [mid]: v } }))
  }

  function canAdvance(): boolean {
    if (step === "done") return false
    const s = step as number
    if (s === 0 || s === reviewStep) return true
    const p = produtos[s - 1]
    return p ? isProdutoDone(p, respostas) : true
  }

  function goNext() {
    if (step === "done") return
    const s = step as number
    if (s < reviewStep) setStep(s + 1)
  }

  function goBack() {
    if (step === "done" || step === 0) return
    setStep((step as number) - 1)
  }

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    const flat: DominioAvaliacaoResposta[] = []
    for (const p of produtos) for (const m of p.modulos) {
      const estrelas = respostas[p.id]?.[m.id]
      if (estrelas) flat.push({ produtoId: p.id, moduloId: m.id, estrelas })
    }
    const res = await onSubmit(avaliacaoId, flat)
    setSubmitting(false)
    if (res.error) { toast.error(res.error); return }
    setOverall(globalAvg(produtos, respostas))
    playSuccessChord()
    setStep("done")
    toast.success("Avaliação de domínio concluída!")
  }

  const currentStep = step as number
  const isIntro  = step !== "done" && currentStep === 0
  const isRate   = step !== "done" && currentStep >= 1 && currentStep <= produtos.length
  const isReview = step !== "done" && currentStep === reviewStep
  const isDone   = step === "done"

  const currentProduto = isRate ? produtos[currentStep - 1] : null
  const canNext = canAdvance()

  const stepLabel = isDone
    ? "Concluído"
    : isIntro
    ? "Introdução"
    : isRate && currentProduto
    ? currentProduto.nome
    : "Revisão"

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="border-b border-border-default px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold text-text-primary">
                Avaliação de Domínio Técnico
              </SheetTitle>
              <p className="mt-0.5 text-xs text-text-muted">{stepLabel}</p>
            </div>
          </div>
          {!isDone && (
            <div className="mt-3">
              <StepIndicator
                produtos={produtos}
                step={step}
                onClickStep={s => setStep(s)}
              />
            </div>
          )}
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isIntro && <IntroPane produtos={produtos} totalModulos={totalModulos} />}

          {isRate && currentProduto && (
            <RatePane
              key={currentStep}
              produto={currentProduto}
              produtoIdx={currentStep}
              totalProdutos={produtos.length}
              respostas={respostas}
              onSetEstrelas={setEstrelas}
            />
          )}

          {isReview && (
            <ReviewPane
              produtos={produtos}
              respostas={respostas}
              submitting={submitting}
              onEdit={idx => setStep(idx)}
              onConfirm={() => void handleConfirm()}
            />
          )}

          {isDone && (
            <DonePane
              overall={overall}
              onClose={() => handleOpenChange(false)}
            />
          )}
        </div>

        {/* Footer navigation */}
        {!isDone && (
          <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border-default px-5 py-4">
            <p className="min-w-0 flex-1 truncate text-sm text-text-muted">
              {isIntro && "Pronto para começar?"}
              {isRate && currentProduto && (
                canNext
                  ? <><strong className="text-text-primary">Etapa completa.</strong> Avance para a próxima.</>
                  : <>Avalie todos os <strong className="text-text-primary">{currentProduto.modulos.length} módulos</strong> para continuar.</>
              )}
              {isReview && (
                produtos.every(p => isProdutoDone(p, respostas))
                  ? <><strong className="text-text-primary">Tudo pronto.</strong> Envie sua avaliação.</>
                  : <>Faltam itens por avaliar.</>
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              {(step as number) > 0 && !isReview && (
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ChevronLeft className="size-4" />
                  Voltar
                </Button>
              )}
              {isReview && (
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ChevronLeft className="size-4" />
                  Voltar
                </Button>
              )}
              {!isReview && (
                <Button size="sm" disabled={!canNext} onClick={goNext}>
                  {isIntro ? "Começar" : "Próxima etapa"}
                  <ChevronRight className="size-4" />
                </Button>
              )}
              {isReview && (
                <Button
                  size="sm"
                  disabled={submitting || !produtos.every(p => isProdutoDone(p, respostas))}
                  onClick={() => void handleConfirm()}
                >
                  {submitting ? "Enviando…" : "Enviar avaliação"}
                  {!submitting && <ChevronRight className="size-4" />}
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
