"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  completarDominioAvaliacao,
  type DominioProduto,
  type DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
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

function isComplete(
  produtos: DominioProduto[],
  respostas: Record<string, Record<string, number>>,
): boolean {
  for (const produto of produtos) {
    for (const modulo of produto.modulos) {
      if (!respostas[produto.id]?.[modulo.id]) return false
    }
  }
  return true
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = React.useState(0)

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
      role="group"
      aria-label="Avaliação de 1 a 5 estrelas"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            className={cn(
              "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
              filled ? "text-amber-400" : "text-neutral-grey-300 hover:text-amber-300",
            )}
          >
            <Star
              className={cn("size-5 transition-colors", filled ? "fill-current" : "")}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

export function DominioAvaliacaoModal({ avaliacaoId, configSnapshot }: Props) {
  const router = useRouter()
  // respostas[produtoId][moduloId] = estrelas (1..5)
  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)

  const produtos = configSnapshot.filter((p) => p.modulos.length > 0)
  const completed = isComplete(produtos, respostas)
  const mediaGeral = calcMediaGeral(produtos, respostas)

  function setEstrelas(produtoId: string, moduloId: string, val: number) {
    setRespostas((prev) => ({
      ...prev,
      [produtoId]: { ...(prev[produtoId] ?? {}), [moduloId]: val },
    }))
  }

  async function handleSubmit() {
    if (!completed || submitting) return
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
      toast.error(res.error)
      return
    }

    toast.success("Avaliação de domínio concluída!")
    router.refresh()
  }

  return (
    // Backdrop — fixed, covers full screen, pointer-events block scrolling underneath
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      // Block any interaction with the background
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dominio-modal-title"
        aria-describedby="dominio-modal-desc"
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-foreground/10"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border-default px-6 py-5">
          <h2
            id="dominio-modal-title"
            className="text-lg font-semibold leading-tight text-text-primary"
          >
            Avaliação de Domínio
          </h2>
          <p
            id="dominio-modal-desc"
            className="mt-1 text-sm text-text-secondary"
          >
            Avalie seu nível de domínio em cada módulo de produto. Todos os campos são obrigatórios.
          </p>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {produtos.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Nenhum produto com módulos configurado.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {produtos.map((produto) => {
                const media = calcProdutoMedia(produto, respostas)

                return (
                  <div
                    key={produto.id}
                    className="rounded-xl border border-border-default bg-surface-card p-4"
                  >
                    {/* Product header */}
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-text-primary">
                        {produto.nome}
                      </span>
                      {media !== null ? (
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            media >= 80
                              ? "text-green-600 dark:text-green-400"
                              : media >= 50
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400",
                          )}
                        >
                          Média: {media.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-sm text-text-secondary italic">Média: —</span>
                      )}
                    </div>

                    {/* Modules */}
                    <div className="flex flex-col divide-y divide-border-default">
                      {produto.modulos.map((modulo) => {
                        const val = respostas[produto.id]?.[modulo.id] ?? 0

                        return (
                          <div
                            key={modulo.id}
                            className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                          >
                            <span className="text-sm text-text-primary">{modulo.nome}</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <StarRating
                                value={val}
                                onChange={(v) => setEstrelas(produto.id, modulo.id, v)}
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
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border-default bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Domínio Geral
              </span>
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  mediaGeral === null
                    ? "text-text-secondary"
                    : mediaGeral >= 80
                      ? "text-green-600 dark:text-green-400"
                      : mediaGeral >= 50
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                )}
              >
                {mediaGeral !== null ? `${mediaGeral.toFixed(0)}%` : "—"}
              </span>
            </div>

            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!completed || submitting || produtos.length === 0}
              className="min-w-40"
            >
              {submitting ? "Salvando…" : "Confirmar Avaliação"}
            </Button>
          </div>

          {!completed && produtos.length > 0 ? (
            <p className="mt-2 text-xs text-text-secondary">
              Avalie todos os módulos antes de confirmar.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
