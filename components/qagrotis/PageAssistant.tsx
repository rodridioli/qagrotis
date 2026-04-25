"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  Sparkles, X, RefreshCw, AlertTriangle, Info, CheckCircle2,
  ArrowRight, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import { usePageAssistantContext } from "@/contexts/PageAssistantContext"
import type { PageAssistantResponse, PageSuggestion } from "@/app/api/page-assistant/route"

export function PageAssistant() {
  const { pageData } = usePageAssistantContext()
  const { sistemaSelecionado } = useSistemaSelecionado()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PageSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastFetchKeyRef = useRef<string>("")

  useEffect(() => setMounted(true), [])

  const fetchSuggestions = useCallback(async () => {
    if (!pageData) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/page-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageData.page, sistema: sistemaSelecionado, data: pageData.data }),
        signal: controller.signal,
      })
      if (!res.ok) {
        if (res.status === 429) setError("Muitas requisições. Aguarde um momento.")
        else setError("Não foi possível obter sugestões.")
        setSuggestions([])
        return
      }
      const data = (await res.json()) as PageAssistantResponse
      setSuggestions(data.suggestions ?? [])
      lastFetchKeyRef.current = makeKey(pageData, sistemaSelecionado)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Não foi possível obter sugestões.")
        setSuggestions([])
      }
    } finally {
      setLoading(false)
    }
  }, [pageData, sistemaSelecionado])

  // When the panel opens, fetch only if data/sistema changed since last fetch
  useEffect(() => {
    if (!open || !pageData) return
    const key = makeKey(pageData, sistemaSelecionado)
    if (key !== lastFetchKeyRef.current) {
      void fetchSuggestions()
    }
  }, [open, pageData, sistemaSelecionado, fetchSuggestions])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  // Cleanup on unmount
  useEffect(() => () => abortRef.current?.abort(), [])

  const showButton = useMemo(() => pageData !== null, [pageData])

  if (!mounted || !showButton) return null

  const fab = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Abrir assistente contextual"
      className={cn(
        "fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full bg-brand-primary text-primary-foreground shadow-card transition-all hover:bg-brand-primary/90 hover:scale-105",
        open && "pointer-events-none opacity-0",
      )}
    >
      <Sparkles className="size-5" aria-hidden="true" />
    </button>
  )

  const panel = open ? (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Assistente contextual">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-surface-card shadow-card",
          "sm:max-w-md sm:border-l sm:border-border-default",
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text-primary">Assistente desta tela</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void fetchSuggestions()}
              disabled={loading}
              aria-label="Atualizar sugestões"
              className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary disabled:opacity-50"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
          {loading && !suggestions && (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="size-5 animate-spin text-brand-primary" aria-hidden="true" />
              <p className="text-sm text-text-secondary">Analisando dados desta tela…</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && suggestions && suggestions.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="size-8 text-text-secondary" aria-hidden="true" />
              <p className="text-sm text-text-secondary">Nenhuma sugestão crítica no momento.</p>
              <p className="text-xs text-text-secondary">Tudo parece em ordem por aqui.</p>
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <ul className="space-y-3">
              {suggestions.map((s, idx) => (
                <SuggestionCard key={idx} suggestion={s} onNavigate={() => setOpen(false)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  ) : null

  return createPortal(
    <>
      {fab}
      {panel}
    </>,
    document.body,
  )
}

function SuggestionCard({ suggestion, onNavigate }: { suggestion: PageSuggestion; onNavigate: () => void }) {
  const Icon = suggestion.type === "warning" ? AlertTriangle : suggestion.type === "info" ? Info : Sparkles
  const accent =
    suggestion.type === "warning"
      ? "border-l-amber-500"
      : suggestion.type === "action"
      ? "border-l-brand-primary"
      : "border-l-text-secondary"
  const iconColor =
    suggestion.type === "warning"
      ? "text-amber-500"
      : suggestion.type === "action"
      ? "text-brand-primary"
      : "text-text-secondary"

  return (
    <li className={cn("rounded-lg border border-border-default border-l-4 bg-surface-input p-3", accent)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-primary">{suggestion.title}</h3>
          {suggestion.description && (
            <p className="mt-1 text-xs text-text-secondary">{suggestion.description}</p>
          )}
          {suggestion.action && (
            <Link
              href={suggestion.action.href}
              onClick={onNavigate}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              {suggestion.action.label}
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}

function makeKey(pageData: { page: string; data: Record<string, unknown> }, sistema: string): string {
  try {
    return `${pageData.page}::${sistema}::${JSON.stringify(pageData.data).slice(0, 500)}`
  } catch {
    return `${pageData.page}::${sistema}`
  }
}
