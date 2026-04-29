"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { LifeBuoy, Send, RotateCcw, Loader2, AlertCircle, X } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { IntegracaoSafeRecord } from "@/lib/actions/integracoes"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  error?: boolean
}

export interface AssistenteDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  integracoes?: IntegracaoSafeRecord[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssistenteDrawer({ open, onOpenChange }: AssistenteDrawerProps) {
  const { sistemaSelecionado } = useSistemaSelecionado()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Init selected integration when list loads
  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [open])

  const sendMessage = useCallback(async (text?: string) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    }
    const assistantId = crypto.randomUUID()

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ])
    setInput("")
    setIsLoading(true)

    // Build history from current messages (exclude the placeholder we just added)
    const historico = messages
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      abortRef.current = new AbortController()

      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta: trimmed,
          sistema: sistemaSelecionado,

          historico,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errText || "Ocorreu um erro. Tente novamente.", error: true }
              : m
          )
        )
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snapshot = accumulated
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: snapshot } : m
          )
        )
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Conexão interrompida. Tente novamente.", error: true }
              : m
          )
        )
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, isLoading, messages, sistemaSelecionado])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearHistory() {
    if (isLoading) {
      abortRef.current?.abort()
      setIsLoading(false)
    }
    setMessages([])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="p-0 sm:max-w-md"
      >
        {/* Single flex-col child so SheetContent's gap-4 is irrelevant */}
        <div className="flex h-full flex-col">

          {/* ── Header ── */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary">
                <LifeBuoy className="size-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold leading-none text-text-primary">
                  Central de Ajuda
                </SheetTitle>
                <p className="mt-0.5 text-xs text-text-secondary">Base de Conhecimento</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={clearHistory}
                  title="Limpar conversa"
                  aria-label="Limpar histórico da conversa"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar central de ajuda"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>



          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Input ── */}
          <div className="shrink-0 border-t border-border-default bg-surface-card px-3 py-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Faça uma pergunta…"
                  disabled={isLoading}
                  maxLength={600}
                  aria-label="Mensagem para o assistente"
                />
              </div>
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                size="icon"
                aria-label="Enviar mensagem"
              >
                {isLoading
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Send className="size-4" />
                }
              </Button>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-primary/10">
        <LifeBuoy className="size-7 text-brand-primary" />
      </div>
      <p className="text-sm font-medium text-text-primary">Como posso ajudar?</p>
    </div>
  )
}

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-xs leading-relaxed text-text-primary last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-text-secondary">{children}</em>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="font-medium text-brand-primary underline underline-offset-2 hover:text-brand-primary/80 transition-colors">
      {children}
    </a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 space-y-0.5 pl-1 text-xs text-text-primary">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 space-y-0.5 pl-4 text-xs text-text-primary list-decimal">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-1.5 leading-relaxed">
      <span className="mt-[5px] shrink-0 size-1.5 rounded-full bg-brand-primary/50" />
      <span>{children}</span>
    </li>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-1.5 mt-3 text-sm font-semibold text-text-primary first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1 mt-2.5 text-xs font-semibold uppercase tracking-wide text-text-secondary first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 text-xs font-semibold text-text-primary first:mt-0">{children}</h3>
  ),
  hr: () => <hr className="my-2.5 border-border-default" />,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-neutral-grey-100 px-1 py-0.5 text-[10px] font-mono text-text-primary">{children}</code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-brand-primary/40 pl-2.5 text-xs italic text-text-secondary">{children}</blockquote>
  ),
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 overflow-hidden">
      <ReactMarkdown components={MD_COMPONENTS}>{content}</ReactMarkdown>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary">
          <LifeBuoy className="size-3.5 text-white" />
        </div>
      )}
      <div
        className={cn(
          "min-w-0 rounded-2xl px-3.5 py-2.5",
          isUser
            ? "max-w-[80%] rounded-br-sm bg-brand-primary text-white text-sm"
            : msg.error
              ? "w-full rounded-bl-sm border border-destructive/20 bg-destructive/10 text-destructive text-xs"
              : "w-full rounded-bl-sm border border-border-default bg-surface-card text-text-primary"
        )}
      >
        {/* Loading state */}
        {!isUser && !msg.content && !msg.error && (
          <div className="flex items-center gap-2 py-1">
            <span className="flex gap-0.5">
              <span className="size-1.5 rounded-full bg-brand-primary/60 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-brand-primary/60 animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-brand-primary/60 animate-bounce [animation-delay:300ms]" />
            </span>
            <span className="text-xs text-text-secondary">Buscando na documentação…</span>
          </div>
        )}

        {/* Error */}
        {msg.error && (
          <div className="flex items-start gap-1.5 text-xs">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{msg.content}</span>
          </div>
        )}

        {/* User message */}
        {isUser && <span>{msg.content}</span>}

        {/* Assistant — typewriter effect */}
        {!isUser && !msg.error && msg.content && (
          <AssistantMarkdown content={msg.content} />
        )}
      </div>
    </div>
  )
}
