"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { Sparkles, X, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CommandBarSuggestions } from "./CommandBarSuggestions"
import { CommandBarResult } from "./CommandBarResult"
import { CommandBarConfirm } from "./CommandBarConfirm"
import { useCommandBarContext } from "@/contexts/CommandBarContext"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { CommandBarItem } from "./CommandBarResult"

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommandBarResponse =
  | { type: "navigate"; path: string; label: string }
  | { type: "query"; title: string; items: CommandBarItem[]; viewAllPath: string }
  | { type: "action"; actionType: "create" | "update" | "delete"; label: string; details: string[]; payload: Record<string, unknown> }
  | { type: "error"; message: string; suggestion: string }
  | { type: "clarify"; question: string; options?: string[] }

type BarStatus = "idle" | "loading" | "result" | "confirm" | "success" | "error"

// ── History helpers ───────────────────────────────────────────────────────────

const HISTORY_KEY = "qa_command_history"
const MAX_HISTORY = 10

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function addToHistory(command: string, current: string[]): string[] {
  const filtered = current.filter((c) => c !== command)
  const next = [command, ...filtered].slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // Incognito or storage full — ignore silently
  }
  return next
}

// ── Focus trap ────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  "a[href]",
].join(", ")

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return
    const el = ref.current

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    el.addEventListener("keydown", handleKeyDown)
    return () => el.removeEventListener("keydown", handleKeyDown)
  }, [ref, active])
}

// ── Context label / placeholder ───────────────────────────────────────────────

const CONTEXT_LABELS: Record<string, string> = {
  "/dashboard": "Painel",
  "/cenarios": "Cenários",
  "/suites": "Suítes",
  "/gerador": "Gerador",
  "/equipe": "Equipe",
  "/configuracoes": "Configurações",
  "/atualizacoes": "Atualizações",
  "/assistente": "Assistente",
  "/documentos": "Documentos",
}

function getContextLabel(pathname: string): string {
  for (const [key, label] of Object.entries(CONTEXT_LABELS)) {
    if (pathname.startsWith(key)) return label
  }
  return "QAgrotis"
}

function getPlaceholder(pathname: string): string {
  if (pathname.startsWith("/cenarios")) return "Ex.: liste cenários com erro no módulo Financeiro..."
  if (pathname.startsWith("/suites")) return "Ex.: crie uma suite de regressão para vendas..."
  if (pathname.startsWith("/gerador")) return "Ex.: gere um cenário para login com autenticação OAuth..."
  if (pathname.startsWith("/equipe")) return "Ex.: crie um novo chapter de automação de testes..."
  if (pathname.startsWith("/dashboard")) return "Ex.: mostre minha atividade recente..."
  return "O que você quer fazer?"
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommandBar() {
  const { isOpen, close, toggle } = useCommandBarContext()
  const { sistemaSelecionado } = useSistemaSelecionado()
  const pathname = usePathname()
  const router = useRouter()

  const [input, setInput] = useState("")
  const [status, setStatus] = useState<BarStatus>("idle")
  const [response, setResponse] = useState<CommandBarResponse | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isConfirming, setIsConfirming] = useState(false)
  const [mounted, setMounted] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useFocusTrap(panelRef, isOpen)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setHistory(loadHistory()) }, [])

  // Global Ctrl+K / ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        toggle()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [toggle])

  // Focus management on open/close
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    } else {
      setInput("")
      setStatus("idle")
      setResponse(null)
      setHistoryIndex(-1)
      setIsConfirming(false)
      abortRef.current?.abort()
      const el = prevFocusRef.current
      setTimeout(() => el?.focus(), 100)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    abortRef.current?.abort()
    close()
  }, [close])

  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setStatus("loading")

    try {
      const res = await fetch("/api/command-bar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed, context: { pathname, sistema: sistemaSelecionado } }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        setStatus("error")
        setResponse({
          type: "error",
          message: "Erro ao processar o comando.",
          suggestion: 'Tente: "Liste cenários com erro" ou "Crie uma suite para o módulo Financeiro".',
        })
        return
      }

      const data = (await res.json()) as CommandBarResponse

      setHistory((prev) => addToHistory(trimmed, prev))
      setHistoryIndex(-1)

      if (data.type === "navigate") {
        router.push(data.path)
        close()
        return
      }

      if (data.type === "action") {
        const actionName = typeof data.payload.actionName === "string" ? data.payload.actionName : ""

        // Search actions auto-execute — no confirmation needed, returns real DB data
        if (actionName === "buscar_cenarios" || actionName === "buscar_suites") {
          const execRes = await fetch("/api/command-bar/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionName, payload: data.payload }),
            signal: abortRef.current?.signal,
          })
          const execData = await execRes.json() as {
            success: boolean
            results?: { title: string; items: CommandBarItem[]; viewAllPath: string }
            error?: string
          }
          if (!execData.success || !execData.results) {
            setStatus("error")
            setResponse({
              type: "error",
              message: execData.error ?? "Erro ao buscar dados.",
              suggestion: "Tente reformular o comando.",
            })
            return
          }
          setStatus("result")
          setResponse({ type: "query", ...execData.results })
          return
        }

        setStatus("confirm")
        setResponse(data)
        return
      }

      if (data.type === "error") {
        setStatus("error")
        setResponse(data)
        return
      }

      setStatus("result")
      setResponse(data)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStatus("error")
        setResponse({
          type: "error",
          message: "Erro de conexão.",
          suggestion: "Verifique sua internet e tente novamente.",
        })
      }
    }
  }, [pathname, sistemaSelecionado, close, router])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (status === "idle" || status === "error") executeCommand(input)
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      handleClose()
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length === 0) return
      const nextIdx = Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(nextIdx)
      setInput(history[nextIdx] ?? "")
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setInput("")
      } else {
        const nextIdx = historyIndex - 1
        setHistoryIndex(nextIdx)
        setInput(history[nextIdx] ?? "")
      }
    }
  }, [input, status, history, historyIndex, executeCommand, handleClose])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (status === "error" || status === "result" || status === "confirm") {
      setStatus("idle")
      setResponse(null)
    }
    setHistoryIndex(-1)
  }, [status])

  const handleConfirm = useCallback(async () => {
    if (isConfirming || !response || response.type !== "action") return
    setIsConfirming(true)

    try {
      const actionName = typeof response.payload.actionName === "string" ? response.payload.actionName : ""
      if (!actionName) {
        toast.error("Ação inválida. Tente novamente com outro comando.")
        return
      }
      const res = await fetch("/api/command-bar/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionName, payload: response.payload }),
      })
      const data = await res.json() as { success: boolean; message?: string; error?: string; redirectPath?: string }

      if (!data.success) {
        setIsConfirming(false)
        toast.error(data.error ?? "Erro ao executar a ação.")
        return
      }

      setStatus("success")
      toast.success(data.message ?? `${response.label} realizado com sucesso!`)

      if (data.redirectPath) {
        setTimeout(() => { router.push(data.redirectPath!); close() }, 1000)
      } else {
        setTimeout(() => close(), 1500)
      }
    } catch {
      toast.error("Erro de conexão ao executar a ação.")
    } finally {
      setIsConfirming(false)
    }
  }, [isConfirming, response, close, router])

  const handleCancel = useCallback(() => {
    setStatus("idle")
    setResponse(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleSuggestionSelect = useCallback((command: string) => {
    setInput(command)
    executeCommand(command)
  }, [executeCommand])

  const handleViewAll = useCallback((path: string) => {
    router.push(path)
    close()
  }, [router, close])

  const contextLabel = getContextLabel(pathname)
  const placeholder = getPlaceholder(pathname)
  const isInputDisabled = status === "loading" || status === "confirm" || status === "success"

  if (!mounted || !isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex flex-col items-center justify-end px-0 sm:justify-start sm:px-4 sm:pt-[12vh]"
      data-testid="command-bar-backdrop"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-default/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Barra de comandos com IA"
        data-testid="command-bar-panel"
        className={cn(
          "relative z-10 w-full overflow-hidden border border-border-default bg-surface-card",
          // Mobile: bottom sheet
          "rounded-t-xl sm:max-w-[640px] sm:rounded-lg",
          "shadow-card"
        )}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border-default" />
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 px-3 py-3">
          <Sparkles className="size-4 shrink-0 text-brand-primary" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            disabled={isInputDisabled}
            aria-label="Comando em linguagem natural"
            data-testid="command-bar-input"
            className={cn(
              "flex-1 bg-transparent text-sm text-text-primary outline-none",
              "placeholder:text-text-secondary",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {history.length > 0 && status === "idle" && !input && (
              <span className="hidden text-[10px] text-text-secondary sm:block" aria-hidden="true">
                ↑ histórico
              </span>
            )}
            <span
              className="hidden rounded-sm bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-primary sm:inline-block"
              aria-label={`Contexto atual: ${contextLabel}`}
            >
              {contextLabel}
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar barra de comandos"
              data-testid="command-bar-close"
              className="flex size-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary dark:hover:bg-neutral-grey-800"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border-default" />

        {/* Dynamic content */}
        <div
          className="max-h-80 overflow-y-auto"
          aria-live="polite"
          aria-atomic="false"
        >
          {status === "loading" && <LoadingState />}

          {status === "idle" && (
            <CommandBarSuggestions pathname={pathname} onSelect={handleSuggestionSelect} />
          )}

          {status === "result" && response?.type === "query" && (
            <CommandBarResult
              title={response.title}
              items={response.items}
              viewAllPath={response.viewAllPath}
              onViewAll={() => handleViewAll(response.viewAllPath)}
              onClose={handleClose}
            />
          )}

          {status === "result" && response?.type === "clarify" && (
            <ClarifyState
              question={response.question}
              options={response.options}
              onSelect={(opt) => {
                const cmd = input.trim() ? `${input.trim()} no módulo ${opt}` : opt
                setInput(cmd)
                executeCommand(cmd)
              }}
            />
          )}

          {status === "confirm" && response?.type === "action" && (
            <CommandBarConfirm
              actionType={response.actionType}
              label={response.label}
              details={response.details}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              isConfirming={isConfirming}
            />
          )}

          {status === "error" && response?.type === "error" && (
            <ErrorState
              message={response.message}
              suggestion={response.suggestion}
              onRetry={() => {
                setStatus("idle")
                setResponse(null)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
            />
          )}

          {status === "success" && <SuccessState />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-default px-3 py-2">
          <div className="flex items-center gap-3">
            <FooterHint kbd="Esc" label="fechar" />
            <FooterHint kbd="Enter" label="executar" />
            <FooterHint kbd="↑" label="histórico" />
          </div>
          <span className="hidden text-[10px] text-text-secondary sm:block">Ctrl+K</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Inline state components ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-2.5 p-4" data-testid="command-bar-loading">
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-brand-primary/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-primary" />
      </div>
      <p className="text-sm text-text-secondary">Interpretando comando...</p>
    </div>
  )
}

function ErrorState({ message, suggestion, onRetry }: { message: string; suggestion: string; onRetry: () => void }) {
  return (
    <div className="p-4" data-testid="command-bar-error">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-3.5 text-destructive" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-medium text-text-primary">{message}</p>
          <p className="text-xs text-text-secondary">{suggestion}</p>
        </div>
      </div>
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="command-bar-retry">
          Tentar novamente
        </Button>
      </div>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="flex items-center gap-2.5 p-4" data-testid="command-bar-success">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500/10">
        <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-text-primary">Ação realizada com sucesso!</p>
    </div>
  )
}

function ClarifyState({ question, options, onSelect }: { question: string; options?: string[]; onSelect: (opt: string) => void }) {
  return (
    <div className="space-y-2.5 p-4" data-testid="command-bar-clarify">
      <p className="text-sm text-text-primary">{question}</p>
      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className="rounded border border-border-default px-2.5 py-1 text-xs text-text-primary transition-colors hover:border-brand-primary hover:text-brand-primary focus-visible:border-brand-primary focus-visible:outline-none"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FooterHint({ kbd, label }: { kbd: string; label: string }) {
  return (
    <span className="hidden items-center gap-1 text-[10px] text-text-secondary sm:flex">
      <kbd className="rounded bg-neutral-grey-100 px-1 py-0.5 font-mono text-[9px] dark:bg-neutral-grey-800">
        {kbd}
      </kbd>
      {label}
    </span>
  )
}
