"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Bot, Send, RotateCcw, Loader2, AlertCircle, X } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { IntegracaoRecord } from "@/lib/actions/integracoes"

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
  integracoes?: IntegracaoRecord[]
}

// ── Suggested starter questions ───────────────────────────────────────────────

const SUGESTOES = [
  "Como cadastrar um novo cliente?",
  "Quais são os campos obrigatórios?",
  "Como funciona a aprovação de pedidos?",
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AssistenteDrawer({ open, onOpenChange, integracoes = [] }: AssistenteDrawerProps) {
  const { sistemaSelecionado } = useSistemaSelecionado()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [integracaoId, setIntegracaoId] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Init selected integration when list loads
  useEffect(() => {
    if (integracoes.length > 0 && !integracaoId) {
      setIntegracaoId(integracoes[0].id)
    }
  }, [integracoes, integracaoId])

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
          integracaoId: integracaoId || undefined,
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
  }, [input, isLoading, messages, sistemaSelecionado, integracaoId])

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
                <Bot className="size-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold leading-none text-text-primary">
                  Assistente de IA
                </SheetTitle>
                <p className="mt-0.5 text-xs text-text-secondary">{sistemaSelecionado}</p>
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
                aria-label="Fechar assistente"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* ── Integration selector ── */}
          <div className="shrink-0 border-b border-border-default px-4 py-2">
            <Select 
              value={integracoes.length > 0 ? integracaoId : ""} 
              onValueChange={(v) => setIntegracaoId(v ?? "")}
              disabled={integracoes.length === 0}
            >
              <SelectTrigger className="h-7 text-xs">
                <span className="mr-1 text-text-secondary">Modelo:</span>
                <SelectValue placeholder={integracoes.length > 0 ? "Selecionar modelo" : "Não cadastrado"}>
                  {integracoes.length > 0 
                    ? (integracoes.find((i) => i.id === integracaoId)?.descricao || 
                       integracoes.find((i) => i.id === integracaoId)?.model || 
                       "Selecionar modelo")
                    : "Não cadastrado"
                  }
                </SelectValue>
              </SelectTrigger>
              {integracoes.length > 0 && (
                <SelectPopup>
                  {integracoes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.descricao || i.model}
                    </SelectItem>
                  ))}
                </SelectPopup>
              )}
            </Select>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <EmptyState onSuggestion={(s) => sendMessage(s)} />
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

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-primary/10">
        <Bot className="size-7 text-brand-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">Como posso ajudar?</p>
        </div>
      <div className="flex w-full max-w-xs flex-col gap-1.5">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="cursor-pointer rounded-lg border border-border-default bg-surface-card px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:border-brand-primary hover:text-text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary">
          <Bot className="size-3.5 text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "rounded-br-sm bg-brand-primary text-white"
            : msg.error
              ? "rounded-bl-sm border border-destructive/20 bg-destructive/10 text-destructive"
              : "rounded-bl-sm border border-border-default bg-surface-card text-text-primary"
        )}
      >
        {/* Loading state (empty assistant message) */}
        {!isUser && !msg.content && !msg.error && (
          <div className="flex items-center gap-1.5 py-0.5">
            <Loader2 className="size-3.5 animate-spin text-text-secondary" />
            <span className="text-xs text-text-secondary">Buscando na documentação…</span>
          </div>
        )}

        {/* Error */}
        {msg.error && (
          <div className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{msg.content}</span>
          </div>
        )}

        {/* User message */}
        {isUser && <span>{msg.content}</span>}

        {/* Assistant markdown */}
        {!isUser && !msg.error && msg.content && (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-default [&_pre]:p-3 [&_code]:rounded [&_code]:bg-surface-default [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
