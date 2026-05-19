"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  DominioProduto,
  DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  avaliacaoId: string
  configSnapshot: DominioProduto[]
  onSubmit: (id: string, respostas: DominioAvaliacaoResposta[]) => Promise<{ error?: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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

/** Replica exata do calcResultado do backend (média de médias por produto). */
function calcMediaGeral(
  produtos: DominioProduto[],
  respostas: Record<string, Record<string, number>>,
): number {
  const produtoAvgs: number[] = []
  for (const p of produtos) {
    const scores = p.modulos
      .map((m) => respostas[p.id]?.[m.id])
      .filter((v): v is number => !!v)
      .map((v) => (v / 5) * 100)
    if (scores.length > 0)
      produtoAvgs.push(scores.reduce((a, b) => a + b, 0) / scores.length)
  }
  if (produtoAvgs.length === 0) return 0
  return produtoAvgs.reduce((a, b) => a + b, 0) / produtoAvgs.length
}

function calcMediaProduto(
  produto: DominioProduto,
  respostas: Record<string, Record<string, number>>,
): number | null {
  const scores = produto.modulos
    .map((m) => respostas[produto.id]?.[m.id])
    .filter((v): v is number => !!v)
    .map((v) => (v / 5) * 100)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

// ─── StarInput ────────────────────────────────────────────────────────────────

function StarInput({
  value,
  onChange,
  name,
}: {
  value: number
  onChange: (v: number) => void
  name: string
}) {
  const [hover, setHover] = React.useState(0)
  const display = hover || value

  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={`Avalie ${name}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
        >
          <Star
            className={cn(
              "size-4 shrink-0 transition-colors",
              display >= i
                ? "fill-badge-warning text-badge-warning"
                : "fill-neutral-grey-200 text-neutral-grey-200",
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}

// ─── ModuloRow interativo ─────────────────────────────────────────────────────

function ModuloRowInput({
  nome,
  value,
  onChange,
}: {
  nome: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Tooltip>
        <TooltipTrigger render={<span className="min-w-0 truncate text-sm text-text-secondary" />}>
          {nome}
        </TooltipTrigger>
        <TooltipContent side="top">{nome}</TooltipContent>
      </Tooltip>
      <div className="shrink-0">
        <StarInput value={value} onChange={onChange} name={nome} />
      </div>
    </div>
  )
}

// ─── ProdutoCard interativo ───────────────────────────────────────────────────

function ProdutoCardInput({
  produto,
  respostas,
  onSetEstrelas,
}: {
  produto: DominioProduto
  respostas: Record<string, Record<string, number>>
  onSetEstrelas: (pid: string, mid: string, v: number) => void
}) {
  const [expanded, setExpanded] = React.useState(true)
  const media = calcMediaProduto(produto, respostas)

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-grey-50"
        aria-expanded={expanded}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary" />
            }
          >
            {produto.nome}
          </TooltipTrigger>
          <TooltipContent side="top">{produto.nome}</TooltipContent>
        </Tooltip>
        <div className="flex shrink-0 items-center gap-2">
          {media !== null ? (
            <>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-grey-200">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    scoreBarClass(media),
                  )}
                  style={{ width: `${media}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-10 text-right text-sm font-bold tabular-nums",
                  scoreToneClass(media),
                )}
              >
                {media.toFixed(0)}%
              </span>
            </>
          ) : (
            <span className="w-10 text-right text-xs tabular-nums text-text-secondary">0%</span>
          )}
          <svg
            className={cn(
              "size-4 shrink-0 text-text-secondary transition-transform duration-200",
              expanded && "rotate-180",
            )}
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
            <ModuloRowInput
              key={m.id}
              nome={m.nome}
              value={respostas[produto.id]?.[m.id] ?? 0}
              onChange={(v) => onSetEstrelas(produto.id, m.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DominioResponderSheet({
  open,
  onOpenChange,
  avaliacaoId,
  configSnapshot,
  onSubmit,
}: Props) {
  const produtos = React.useMemo(
    () => configSnapshot.filter((p) => p.modulos.length > 0),
    [configSnapshot],
  )

  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmExitOpen, setConfirmExitOpen] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setRespostas({})
      setSubmitting(false)
    }
  }, [open])

  function setEstrelas(pid: string, mid: string, v: number) {
    setRespostas((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] ?? {}), [mid]: v },
    }))
  }

  const totalModulos = React.useMemo(
    () => produtos.reduce((acc, p) => acc + p.modulos.length, 0),
    [produtos],
  )

  const filledCount = React.useMemo(() => {
    let count = 0
    for (const p of produtos)
      for (const m of p.modulos)
        if (respostas[p.id]?.[m.id]) count++
    return count
  }, [produtos, respostas])

  const allFilled = filledCount === totalModulos && totalModulos > 0
  const remaining = totalModulos - filledCount

  const mediaGeral = React.useMemo(
    () => calcMediaGeral(produtos, respostas),
    [produtos, respostas],
  )

  function handleOpenChange(next: boolean) {
    if (!next) {
      setConfirmExitOpen(true)
      return
    }
    onOpenChange(next)
  }

  async function handleSubmit() {
    if (submitting || !allFilled) return
    setSubmitting(true)
    const flat: DominioAvaliacaoResposta[] = []
    for (const p of produtos)
      for (const m of p.modulos) {
        const estrelas = respostas[p.id]?.[m.id]
        if (estrelas) flat.push({ produtoId: p.id, moduloId: m.id, estrelas })
      }
    const res = await onSubmit(avaliacaoId, flat)
    setSubmitting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Avaliação de domínio enviada com sucesso.")
    onOpenChange(false)
  }

  const ringStroke =
    mediaGeral === 0
      ? "var(--neutral-grey-200)"
      : mediaGeral >= 80
        ? "var(--color-badge-success)"
        : mediaGeral >= 50
          ? "var(--color-badge-warning)"
          : "var(--color-destructive)"

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <SheetHeader className="border-b border-border-default px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base font-semibold text-text-primary">
                  Nova Avaliação de Domínio
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-xs text-text-secondary">
                  {formatDataPt(todayYmd())} · Pendente
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={() => setConfirmExitOpen(true)}
                className="mt-0.5 shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                aria-label="Fechar"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            {/* Média Geral */}
            <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-card px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Média Geral
                </p>
                <p
                  className={cn(
                    "mt-1 text-4xl font-bold tabular-nums leading-none",
                    mediaGeral > 0 ? scoreToneClass(mediaGeral) : "text-text-secondary",
                  )}
                >
                  {mediaGeral > 0 ? `${mediaGeral.toFixed(0)}%` : "0%"}
                </p>
              </div>
              <div className="relative size-16">
                <svg viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="var(--neutral-grey-200)"
                    strokeWidth="3.2"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke={ringStroke}
                    strokeWidth="3.2"
                    strokeDasharray={`${(mediaGeral / 100) * 100} 100`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Por produto */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Por produto
              </p>
              {produtos.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum produto configurado.</p>
              ) : (
                produtos.map((p) => (
                  <ProdutoCardInput
                    key={p.id}
                    produto={p}
                    respostas={respostas}
                    onSetEstrelas={setEstrelas}
                  />
                ))
              )}
            </div>
          </div>

          <SheetFooter className="border-t border-border-default px-5 py-4">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs text-text-secondary">
                {allFilled
                  ? "Pronto para enviar"
                  : `${remaining} módulo${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
              </p>
              <Button
                type="button"
                disabled={!allFilled || submitting}
                onClick={() => void handleSubmit()}
                className="gap-2"
              >
                {submitting ? "Enviando…" : "Enviar Avaliação"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmExitOpen}
        onOpenChange={setConfirmExitOpen}
        title="Sair da avaliação?"
        description="A avaliação continuará pendente. Você precisará respondê-la em outra ocasião."
        confirmLabel="Sair mesmo assim"
        buttonVariant="destructive"
        onConfirm={() => {
          setConfirmExitOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
