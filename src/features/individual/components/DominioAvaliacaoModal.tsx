"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Star, CheckCircle2 } from "lucide-react"
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

  const [open, setOpen] = React.useState(true)
  const [submitted, setSubmitted] = React.useState(false)
  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [overall, setOverall] = React.useState(0)

  const ratedCount = React.useMemo(() => {
    let count = 0
    for (const p of produtos) for (const m of p.modulos) { if (respostas[p.id]?.[m.id]) count++ }
    return count
  }, [produtos, respostas])

  const allDone = ratedCount === totalModulos && totalModulos > 0
  const progressPct = totalModulos > 0 ? (ratedCount / totalModulos) * 100 : 0

  function handleOpenChange(next: boolean) {
    if (!next && !submitted) return
    if (!next) {
      setOpen(false)
      router.refresh()
    }
  }

  function setEstrelas(pid: string, mid: string, v: number) {
    setRespostas(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [mid]: v } }))
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
    setSubmitted(true)
    toast.success("Avaliação de domínio concluída!")
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        {submitted ? (
          <div className="flex flex-1 items-center justify-center px-5">
            <DonePane overall={overall} onClose={() => handleOpenChange(false)} />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="border-b border-border-default px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base font-semibold text-text-primary">
                    Avaliação de Domínio Técnico
                  </SheetTitle>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {ratedCount} de {totalModulos} módulos avaliados
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-grey-200">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </SheetHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {produtos.map(produto => {
                const avg = produtoAvg(produto, respostas)
                const ratedInProduto = produto.modulos.filter(m => !!respostas[produto.id]?.[m.id]).length

                return (
                  <div key={produto.id} className="border-b border-border-default last:border-0">
                    {/* Product header */}
                    <div className="flex items-center justify-between gap-3 bg-neutral-grey-50 px-5 py-3 dark:bg-neutral-grey-900">
                      <p className="text-sm font-semibold text-text-primary">{produto.nome}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {avg > 0 && (
                          <span className="text-xs text-text-muted tabular-nums">
                            {avg.toFixed(1)} ★
                          </span>
                        )}
                        <span className="text-xs text-text-muted">
                          {ratedInProduto}/{produto.modulos.length}
                        </span>
                      </div>
                    </div>

                    {/* Module rows */}
                    <div className="divide-y divide-border-default">
                      {produto.modulos.map(modulo => {
                        const { code, label } = parseModulo(modulo.nome)
                        const v = respostas[produto.id]?.[modulo.id] ?? 0
                        return (
                          <div
                            key={modulo.id}
                            className="grid grid-cols-[auto_1fr_auto] items-center px-5 py-3"
                          >
                            <div className="w-12 font-mono text-xs font-semibold text-brand-primary">
                              {code ?? "—"}
                            </div>
                            <div className="min-w-0 px-3">
                              <p className="truncate text-sm font-medium text-text-primary">{label}</p>
                              {v > 0 && (
                                <p className="text-xs text-text-muted">{NIVEL[v]}</p>
                              )}
                            </div>
                            <Stars
                              value={v}
                              onChange={val => setEstrelas(produto.id, modulo.id, val)}
                              name={label}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border-default px-5 py-4">
              <p className="min-w-0 flex-1 truncate text-sm text-text-muted">
                {allDone
                  ? <><strong className="text-text-primary">Tudo pronto.</strong> Envie sua avaliação.</>
                  : <>Faltam <strong className="text-text-primary">{totalModulos - ratedCount}</strong> {totalModulos - ratedCount === 1 ? "item" : "itens"} sem nota.</>
                }
              </p>
              <Button
                size="sm"
                disabled={!allDone || submitting}
                onClick={() => void handleConfirm()}
              >
                {submitting ? "Enviando…" : "Enviar avaliação"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
