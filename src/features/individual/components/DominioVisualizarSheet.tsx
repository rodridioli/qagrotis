"use client"

import * as React from "react"
import { Star } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  getDominioAvaliacaoDetalhe,
  type DominioAvaliacaoDetalhe,
  type DominioProduto,
  type DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  avaliacaoId: string | null
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function dominioCodigoPadded(codigo: number): string {
  return `DOM-${String(codigo).padStart(3, "0")}`
}

function scoreToneClass(pct: number): string {
  if (pct >= 80) return "text-badge-success-text"
  if (pct >= 50) return "text-badge-warning-text"
  return "text-destructive"
}

function scoreBarClass(pct: number): string {
  if (pct >= 80) return "bg-badge-success"
  if (pct >= 50) return "bg-badge-warning"
  return "bg-destructive"
}

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3 shrink-0",
            i < count
              ? "fill-badge-warning text-badge-warning"
              : "fill-neutral-grey-200 text-neutral-grey-200",
          )}
          aria-hidden
        />
      ))}
    </span>
  )
}

function ModuloRow({
  nome,
  resposta,
}: {
  nome: string
  resposta: DominioAvaliacaoResposta | undefined
}) {
  const pct = resposta ? (resposta.estrelas / 5) * 100 : null

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-sm text-text-secondary">{nome}</span>
      <div className="flex shrink-0 items-center gap-2">
        {resposta ? (
          <>
            <StarDisplay count={resposta.estrelas} />
            <span className={cn("w-10 text-right text-xs font-semibold tabular-nums", scoreToneClass(pct!))}>
              {pct!.toFixed(0)}%
            </span>
          </>
        ) : (
          <span className="text-xs italic text-text-secondary">—</span>
        )}
      </div>
    </div>
  )
}

function ProdutoCard({
  produto,
  media,
  respostas,
}: {
  produto: DominioProduto
  media: number | null
  respostas: DominioAvaliacaoResposta[]
}) {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-grey-50"
        aria-expanded={expanded}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
          {produto.nome}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {media !== null ? (
            <>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-grey-200">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", scoreBarClass(media))}
                  style={{ width: `${media}%` }}
                />
              </div>
              <span className={cn("w-10 text-right text-sm font-bold tabular-nums", scoreToneClass(media))}>
                {media.toFixed(0)}%
              </span>
            </>
          ) : (
            <span className="text-xs italic text-text-secondary">—</span>
          )}
          <svg
            className={cn("size-4 shrink-0 text-text-secondary transition-transform duration-200", expanded && "rotate-180")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && produto.modulos.length > 0 && (
        <div className="divide-y divide-border-default border-t border-border-default px-4">
          {produto.modulos.map((m) => (
            <ModuloRow
              key={m.id}
              nome={m.nome}
              resposta={respostas.find((r) => r.produtoId === produto.id && r.moduloId === m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-grey-100" />
      ))}
    </div>
  )
}

export function DominioVisualizarSheet({ open, onOpenChange, avaliacaoId }: Props) {
  const [detalhe, setDetalhe] = React.useState<DominioAvaliacaoDetalhe | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !avaliacaoId) return
    setLoading(true)
    setDetalhe(null)
    getDominioAvaliacaoDetalhe(avaliacaoId)
      .then((d) => setDetalhe(d))
      .catch(() => setDetalhe(null))
      .finally(() => setLoading(false))
  }, [open, avaliacaoId])

  const mediaGeral = detalhe?.resultadoPercent ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border-default px-5 py-4">
          <SheetTitle className="text-base font-semibold text-text-primary">
            {detalhe ? dominioCodigoPadded(detalhe.codigo) : "Avaliação de Domínio"}
          </SheetTitle>
          <SheetDescription className="text-xs text-text-secondary">
            {detalhe
              ? `${formatDataPt(detalhe.dataYmd)} · ${detalhe.status === "CONCLUIDA" ? "Concluída" : "Pendente"}`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {loading ? (
            <SkeletonRows />
          ) : !detalhe ? (
            <p className="text-sm text-text-secondary">Não foi possível carregar os dados.</p>
          ) : detalhe.status === "PENDENTE" ? (
            <div className="rounded-xl border border-border-default bg-surface-card px-5 py-8 text-center">
              <p className="text-sm font-medium text-text-secondary">Avaliação pendente</p>
              <p className="mt-1 text-xs text-text-secondary">
                Esta avaliação ainda não foi preenchida.
              </p>
            </div>
          ) : (
            <>
              {/* Média geral */}
              <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-card px-5 py-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Média Geral
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-4xl font-bold tabular-nums leading-none",
                      mediaGeral !== null ? scoreToneClass(mediaGeral) : "text-text-secondary",
                    )}
                  >
                    {mediaGeral !== null ? `${mediaGeral.toFixed(0)}%` : "—"}
                  </p>
                </div>
                {mediaGeral !== null && (
                  <div className="relative size-16">
                    <svg viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
                      <circle
                        cx="18" cy="18" r="15.9"
                        fill="none"
                        stroke="var(--neutral-grey-200)"
                        strokeWidth="3.2"
                      />
                      <circle
                        cx="18" cy="18" r="15.9"
                        fill="none"
                        stroke={mediaGeral >= 80 ? "var(--color-badge-success)" : mediaGeral >= 50 ? "var(--color-badge-warning)" : "var(--color-destructive)"}
                        strokeWidth="3.2"
                        strokeDasharray={`${(mediaGeral / 100) * 100} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Por produto */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Por produto
                </p>
                {detalhe.configSnapshot.map((produto) => {
                  const pm = detalhe.produtoMedias.find((x) => x.produtoId === produto.id)
                  return (
                    <ProdutoCard
                      key={produto.id}
                      produto={produto}
                      media={pm?.media ?? null}
                      respostas={detalhe.respostas}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
