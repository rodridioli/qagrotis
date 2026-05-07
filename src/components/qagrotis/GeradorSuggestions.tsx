"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, AlertTriangle, FileText, ChevronDown, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GeradorSuggestionsResponse, SuggestionItem } from "@/app/api/gerador-suggestions/route"

interface Props {
  contexto: string
  sistema: string
  onApplyModulo?: (modulo: string) => void
  onAppendEdgeCase?: (edgeCase: string) => void
  className?: string
}

const DEBOUNCE_MS = 1000
const MIN_CHARS = 50

export function GeradorSuggestions({ contexto, sistema, onApplyModulo, onAppendEdgeCase, className }: Props) {
  const [suggestions, setSuggestions] = useState<GeradorSuggestionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const lastSentRef = useRef<string>("")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = contexto.trim()
    if (trimmed.length < MIN_CHARS || dismissed) {
      return
    }
    if (trimmed === lastSentRef.current) return

    const handle = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      lastSentRef.current = trimmed
      setLoading(true)

      fetch("/api/gerador-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contexto: trimmed, sistema }),
        signal: controller.signal,
      })
        .then(async (r) => {
          if (!r.ok) return null
          return (await r.json()) as GeradorSuggestionsResponse
        })
        .then((data) => {
          if (controller.signal.aborted) return
          if (data) setSuggestions(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [contexto, sistema, dismissed])

  useEffect(() => () => abortRef.current?.abort(), [])

  if (dismissed) return null

  const trimmed = contexto.trim()
  if (trimmed.length < MIN_CHARS) return null

  const hasContent = suggestions && (
    suggestions.moduloDetectado ||
    suggestions.edgeCases.length > 0 ||
    suggestions.cenariosSimilares.length > 0
  )

  if (!loading && !hasContent) return null

  return (
    <div
      role="region"
      aria-label="Sugestões da IA"
      className={cn(
        "rounded-xl border border-border-default bg-surface-card",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-text-primary">Sugestões da IA</span>
          {loading && <Loader2 className="size-3.5 animate-spin text-text-secondary" aria-hidden="true" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
            aria-label="Dispensar sugestões"
            className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
          <ChevronDown
            className={cn("size-4 text-text-secondary transition-transform", open ? "rotate-180" : "")}
            aria-hidden="true"
          />
        </div>
      </button>

      {open && hasContent && (
        <div className="space-y-4 border-t border-border-subtle p-4" aria-live="polite">
          {suggestions?.moduloDetectado && (
            <SectionModulo modulo={suggestions.moduloDetectado} onApply={onApplyModulo} />
          )}
          {suggestions && suggestions.cenariosSimilares.length > 0 && (
            <SectionSimilares items={suggestions.cenariosSimilares} />
          )}
          {suggestions && suggestions.edgeCases.length > 0 && (
            <SectionEdgeCases edgeCases={suggestions.edgeCases} onAppend={onAppendEdgeCase} />
          )}
        </div>
      )}
    </div>
  )
}

function SectionModulo({ modulo, onApply }: { modulo: string; onApply?: (m: string) => void }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Módulo detectado</h4>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-brand-primary/10 px-2 py-1 text-xs font-medium text-brand-primary">
          {modulo}
        </span>
        {onApply && (
          <button
            type="button"
            onClick={() => onApply(modulo)}
            className="text-xs text-brand-primary underline-offset-2 hover:underline"
          >
            Aplicar
          </button>
        )}
      </div>
    </div>
  )
}

function SectionSimilares({ items }: { items: SuggestionItem[] }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Possíveis duplicatas ({items.length})
      </h4>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-2 rounded-md bg-surface-input px-2.5 py-1.5 text-xs">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-text-primary">{c.name}</p>
              <p className="truncate text-text-secondary">{c.id} · {c.module}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionEdgeCases({ edgeCases, onAppend }: { edgeCases: string[]; onAppend?: (text: string) => void }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Edge cases sugeridos
      </h4>
      <ul className="space-y-1.5">
        {edgeCases.map((ec, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs text-text-primary">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
            <span className="flex-1">{ec}</span>
            {onAppend && (
              <button
                type="button"
                onClick={() => onAppend(ec)}
                className="shrink-0 text-xs text-brand-primary underline-offset-2 hover:underline"
                aria-label={`Adicionar edge case: ${ec}`}
              >
                + Adicionar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
