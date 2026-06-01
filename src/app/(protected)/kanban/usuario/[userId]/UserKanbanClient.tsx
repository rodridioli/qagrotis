"use client"

import React from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { AlertCircle, Check, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Clock, Equal, EyeOff, Flag, Loader2, RefreshCw, Search, User, X } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/core/utils"
import { PageBreadcrumb } from "@/components/shared/PageBreadcrumb"
import type { UserKanbanData, UserKanbanCard, UserKanbanColumn } from "@/features/kanban/actions/ux-kanban"
import {
  moveCardInUserKanban,
  completeCardDone,
  confirmInApproval,
  searchJiraUsers,
} from "@/features/kanban/actions/ux-kanban"
import {
  startCardTimer,
  stopCardTimer,
  getActiveTimersForCards,
  getClockworkTotalsForCards,
  type TimerState,
} from "@/features/kanban/actions/clockwork-timer"

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: { id: UserKanbanColumn; label: string; color: string; chipClass: string }[] = [
  { id: "backlog",     label: "Pendências",    color: "border-t-slate-400",   chipClass: "border-secondary-500/30 bg-secondary-500/10 text-secondary-600" },
  { id: "in_progress", label: "Em andamento",  color: "border-t-blue-500",    chipClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { id: "paused",      label: "Pausado",       color: "border-t-amber-400",   chipClass: "border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400" },
  { id: "waiting",     label: "Aguardando",    color: "border-t-cyan-500",    chipClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
  { id: "in_approval", label: "Em aprovação",  color: "border-t-purple-500",  chipClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  { id: "done",        label: "Feito",         color: "border-t-emerald-500", chipClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  { id: "canceled",    label: "Cancelado",     color: "border-t-slate-300",   chipClass: "border-secondary-500/30 bg-secondary-500/10 text-secondary-600" },
]

/** Columns the user can hide. Order preserved from COLUMNS. */
const HIDEABLE_COLS = new Set<UserKanbanColumn>(["paused", "waiting", "canceled"])
const LS_KEY = (uid: string) => `kanban-hidden-cols-v1-${uid}`
const DEFAULT_HIDDEN: UserKanbanColumn[] = ["paused", "waiting"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T12:00:00Z")
  if (isNaN(d.getTime())) return null
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${d.getUTCFullYear()}`
}

const PRIORITY_LABEL_PT: Record<string, string> = {
  highest: "Crítica",
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  lowest: "Mínima",
}

const PRIORITY_RANK: Record<string, number> = {
  highest: 0, critical: 0, high: 1, medium: 2, low: 3, lowest: 4,
}

function priorityRank(p: string | null): number {
  return PRIORITY_RANK[p?.toLowerCase() ?? ""] ?? 99
}

// ─── Priority icon ────────────────────────────────────────────────────────────

const PRIORITY_ICON_MAP: Record<string, { Icon: React.ElementType; className: string }> = {
  highest:  { Icon: ChevronsUp,   className: "text-red-500" },
  critical: { Icon: ChevronsUp,   className: "text-red-500" },
  high:     { Icon: ChevronUp,    className: "text-orange-500" },
  medium:   { Icon: Equal,        className: "text-yellow-500" },
  low:      { Icon: ChevronDown,  className: "text-blue-400" },
  lowest:   { Icon: ChevronsDown, className: "text-text-secondary" },
}

function PriorityIcon({ priority, label }: { priority: string; label: string }) {
  const config = PRIORITY_ICON_MAP[priority.toLowerCase()]
  if (!config) return null
  const { Icon, className } = config
  return <Icon className={cn("size-4 shrink-0", className)} aria-label={label} />
}

function sortCards(cards: UserKanbanCard[]): UserKanbanCard[] {
  return [...cards].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority)
    if (pr !== 0) return pr
    const aDate = a.deadline ?? a.dueDate
    const bDate = b.deadline ?? b.dueDate
    if (aDate && bDate) return aDate.localeCompare(bDate)
    if (aDate) return -1
    if (bDate) return 1
    return 0
  })
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

/** Formata segundos totais como HH:MM:SS. */
function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":")
}

// ─── Done modal ───────────────────────────────────────────────────────────────

type MentionUser = { accountId: string; displayName: string; avatarUrl: string | null }

function DoneModal({
  card,
  onConfirm,
  onClose,
}: {
  card: UserKanbanCard
  onConfirm: (mentionedUser: MentionUser | null) => Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<MentionUser[]>([])
  const [searching, setSearching] = React.useState(false)
  const [selected, setSelected] = React.useState<MentionUser | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || selected) { setSuggestions([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchJiraUsers(query).catch(() => ({ ok: false as const, users: [] }))
      setSuggestions(res.ok ? (res.users ?? []) : [])
      setSearching(false)
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected])

  const jiraUrl = `https://agrotis.atlassian.net/browse/${card.key}`

  const handleConfirm = async () => {
    setSubmitting(true)
    await onConfirm(selected)
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-card shadow-2xl p-6 space-y-5 mx-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-text-primary">Confirmar entrega</h2>
            <p className="text-sm text-text-secondary">
              O card{" "}
              <a href={jiraUrl} target="_blank" rel="noopener noreferrer"
                className="font-medium text-brand-primary hover:underline">
                {card.key}
              </a>{" "}
              será marcado como entregue e uma notificação será enviada no Jira.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer shrink-0 rounded-lg p-1 text-text-secondary hover:bg-neutral-grey-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* @Mention */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Notificar usuário (opcional)
          </label>
          {selected ? (
            <div className="flex items-center gap-2 rounded-xl border border-brand-primary bg-brand-primary/5 px-3 py-2">
              {selected.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.avatarUrl} alt="" className="size-6 rounded-full" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                  {selected.displayName[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span className="flex-1 text-sm font-medium text-text-primary">{selected.displayName}</span>
              <button
                type="button"
                onClick={() => { setSelected(null); setQuery("") }}
                className="cursor-pointer text-text-secondary hover:text-destructive"
                aria-label="Limpar seleção"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="@nome ou e-mail…"
                className="w-full rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-text-secondary" />
              )}
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-lg">
                  {suggestions.map((u) => (
                    <li key={u.accountId}>
                      <button
                        type="button"
                        onClick={() => { setSelected(u); setSuggestions([]); setQuery("") }}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-neutral-grey-50"
                      >
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="size-7 rounded-full" />
                        ) : (
                          <span className="flex size-7 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                            {u.displayName[0]?.toUpperCase() ?? "?"}
                          </span>
                        )}
                        <span className="text-text-primary">{u.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-text-secondary">
            Um comentário será inserido no Jira com a @menção e a notificação de entrega.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-xl border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmar entrega
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── In Approval modal ────────────────────────────────────────────────────────

function InApprovalModal({
  card,
  onConfirm,
  onClose,
}: {
  card: UserKanbanCard
  onConfirm: (approver: MentionUser, prototypeLink?: string) => Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<MentionUser[]>([])
  const [searching, setSearching] = React.useState(false)
  const [selected, setSelected] = React.useState<MentionUser | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [prototypeLink, setPrototypeLink] = React.useState("")
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || selected) { setSuggestions([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchJiraUsers(query).catch(() => ({ ok: false as const, users: [] }))
      setSuggestions(res.ok ? (res.users ?? []) : [])
      setSearching(false)
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected])

  const jiraUrl = `https://agrotis.atlassian.net/browse/${card.key}`

  const handleConfirm = async () => {
    if (!selected) return
    setSubmitting(true)
    await onConfirm(selected, prototypeLink.trim() || undefined)
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-card shadow-2xl p-6 space-y-5 mx-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-text-primary">Enviar para aprovação</h2>
            <p className="text-sm text-text-secondary">
              Selecione o aprovador do card{" "}
              <a href={jiraUrl} target="_blank" rel="noopener noreferrer"
                className="font-medium text-brand-primary hover:underline">
                {card.key}
              </a>
              . Um comentário será inserido no Jira notificando o aprovador.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer shrink-0 rounded-lg p-1 text-text-secondary hover:bg-neutral-grey-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Aprovador (obrigatório) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Aprovador <span className="text-destructive">*</span>
          </label>
          {selected ? (
            <div className="flex items-center gap-2 rounded-xl border border-brand-primary bg-brand-primary/5 px-3 py-2">
              {selected.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.avatarUrl} alt="" className="size-6 rounded-full" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                  {selected.displayName[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span className="flex-1 text-sm font-medium text-text-primary">{selected.displayName}</span>
              <button
                type="button"
                onClick={() => { setSelected(null); setQuery("") }}
                className="cursor-pointer text-text-secondary hover:text-destructive"
                aria-label="Limpar seleção"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="@nome ou e-mail…"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="w-full rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-text-secondary" />
              )}
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-lg">
                  {suggestions.map((u) => (
                    <li key={u.accountId}>
                      <button
                        type="button"
                        onClick={() => { setSelected(u); setSuggestions([]); setQuery("") }}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-neutral-grey-50"
                      >
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="size-7 rounded-full" />
                        ) : (
                          <span className="flex size-7 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                            {u.displayName[0]?.toUpperCase() ?? "?"}
                          </span>
                        )}
                        <span className="text-text-primary">{u.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-text-secondary">
            {prototypeLink.trim()
              ? <>O aprovador receberá a mensagem: <em>"@aprovador, a tarefa de UX foi concluída e aguarda a sua aprovação. Link para o protótipo: [ Visualizar ]"</em></>
              : <>O aprovador receberá a mensagem: <em>"@aprovador, a tarefa de UX foi concluída e aguarda a sua aprovação."</em></>
            }
          </p>
        </div>

        {/* Link do protótipo (opcional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Link do protótipo
          </label>
          <input
            type="url"
            value={prototypeLink}
            onChange={(e) => setPrototypeLink(e.target.value)}
            placeholder="https://www.figma.com/proto/…"
            className="w-full rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-xl border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected || submitting}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card component ───────────────────────────────────────────────────────────

function UserKanbanCardView({
  card,
  index,
  onDone,
  timerState,
  nowMs,
  clockworkBase,
  onRefreshClockwork,
}: {
  card: UserKanbanCard
  index: number
  onDone: (card: UserKanbanCard) => void
  timerState: TimerState | null
  nowMs: number
  clockworkBase: number
  onRefreshClockwork: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = React.useState(false)

  const isCanceled = card.column === "canceled"
  const isDone = card.column === "done"
  const jiraUrl = `https://agrotis.atlassian.net/browse/${card.key}`
  const dateStr = formatDate(card.deadline ?? card.dueDate)
  const isTarefa = card.cardType === "ux_tarefa"
  const priorityLabel = card.priority
    ? (PRIORITY_LABEL_PT[card.priority.toLowerCase()] ?? card.priority)
    : null

  // Timer: total Clockwork + elapsed da sessão ativa local
  const hasActiveSession = timerState?.startedAt != null
  const elapsed = hasActiveSession
    ? Math.floor((nowMs - timerState!.startedAt!) / 1000)
    : 0
  const timerSeconds = clockworkBase + elapsed
  const showTimer = timerSeconds > 0 || hasActiveSession

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation()
    setRefreshing(true)
    await onRefreshClockwork()
    setRefreshing(false)
  }

  return (
    <Draggable draggableId={card.key} index={index} isDragDisabled={isCanceled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2 rounded-xl border border-border-default bg-surface-card p-3.5",
            "select-none border-l-[3px]",
            isTarefa ? "border-l-emerald-500" : "border-l-blue-500 dark:border-l-blue-400",
            isCanceled && "opacity-40 grayscale cursor-not-allowed",
            isDone && "opacity-60",
            !isCanceled && !snapshot.isDragging && "cursor-grab",
            !isCanceled && !isDone && !snapshot.isDragging && "shadow-sm transition-shadow hover:shadow-md",
            snapshot.isDragging && "shadow-xl rotate-[0.5deg] opacity-90 scale-[1.01] cursor-grabbing",
          )}
        >
          {/* Header: key + priority */}
          <div className="flex items-center justify-between gap-2">
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "text-sm font-bold underline-offset-2 hover:underline",
                isTarefa ? "text-emerald-600 dark:text-emerald-400" : "text-blue-700 dark:text-blue-300",
              )}
            >
              {card.key}
            </a>
            {priorityLabel && card.priority && (
              <div className="flex shrink-0 items-center gap-1">
                <PriorityIcon priority={card.priority} label={priorityLabel} />
                <span className="text-xs font-medium text-text-secondary">{priorityLabel}</span>
              </div>
            )}
          </div>

          {/* Summary */}
          <p className={cn(
            "text-sm leading-snug line-clamp-3",
            isCanceled ? "line-through text-text-disabled" : "text-text-primary",
          )}>
            {card.summary || "—"}
          </p>

          {/* Date */}
          {dateStr && !isCanceled && (
            <div className="flex items-center gap-1">
              <Flag className="size-3 shrink-0 text-red-500" aria-hidden />
              <span className="text-xs text-red-500">{dateStr}</span>
            </div>
          )}

          {/* Timer */}
          {showTimer && (
            <div
              className="flex items-center gap-1 rounded-md border border-blue-300/50 bg-blue-50 px-2 py-0.5 dark:border-blue-700/40 dark:bg-blue-900/20"
              aria-label="Tempo total no Clockwork"
            >
              <Clock className={cn("size-3 shrink-0 text-blue-500", hasActiveSession && "animate-pulse")} aria-hidden />
              <span className="font-mono text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {formatElapsed(timerSeconds)}
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                aria-label="Atualizar tempo do Clockwork"
                className="ml-0.5 cursor-pointer rounded p-0.5 text-blue-400 transition-opacity hover:text-blue-600 disabled:opacity-40"
                disabled={refreshing}
              >
                <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
              </button>
            </div>
          )}

          {/* Footer: reporter (left) + badge (right), same line */}
          {!isCanceled && (
            <div className="flex items-center justify-between gap-2">
              {(card.solicitanteDisplayName ?? card.reporterDisplayName) ? (
                <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
                  <User className="size-3 shrink-0" aria-hidden />
                  <span className="truncate underline underline-offset-2">
                    {card.solicitanteDisplayName ?? card.reporterDisplayName}
                  </span>
                </div>
              ) : <div />}
              {(card.tag ?? card.projectName) && (
                <span className="shrink-0 rounded border border-border-default bg-surface-card px-2 py-0.5 text-xs font-medium text-text-secondary">
                  {card.tag ?? card.projectName.replace(/^Plataforma Agro - /, "")}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

// ─── Column component ─────────────────────────────────────────────────────────

function KanbanColumnView({
  col,
  cards,
  onDone,
  onHide,
  timerStates,
  nowMs,
  clockworkTotals,
  onRefreshClockwork,
}: {
  col: typeof COLUMNS[number]
  cards: UserKanbanCard[]
  onDone: (card: UserKanbanCard) => void
  onHide?: () => void
  timerStates: Record<string, TimerState>
  nowMs: number
  clockworkTotals: Record<string, number>
  onRefreshClockwork: (issueKey: string) => Promise<void>
}) {
  const [search, setSearch] = React.useState("")
  const displayed = search.trim()
    ? cards.filter((c) => c.key.toLowerCase().includes(search.toLowerCase()) || c.summary.toLowerCase().includes(search.toLowerCase()))
    : cards

  return (
    <div className={cn(
      "flex w-64 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay border-t-2",
      col.color,
    )}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary">
          {col.label}
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {cards.length}
        </span>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            title="Ocultar coluna"
            aria-label="Ocultar coluna"
            className="ml-auto cursor-pointer rounded p-0.5 text-text-secondary opacity-40 transition-opacity hover:opacity-100 hover:text-text-primary"
          >
            <EyeOff className="size-3.5" />
          </button>
        )}
      </div>

      {cards.length > 4 && (
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border border-border-default bg-surface-input py-1 pl-6 pr-2 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        </div>
      )}

      <div className="mx-3 h-px bg-border-default" />

      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-col gap-2.5 overflow-y-auto p-3 scrollbar-thin min-h-[80px] rounded-b-xl transition-colors duration-150",
              snapshot.isDraggingOver ? "bg-brand-primary/[0.04]" : "",
            )}
            style={{ maxHeight: "calc(100dvh - 200px)" }}
          >
            {displayed.length === 0 && !snapshot.isDraggingOver && (
              <p className="py-4 text-center text-xs italic text-text-disabled">Vazio</p>
            )}
            {displayed.map((card, index) => (
              <UserKanbanCardView
                key={card.key}
                card={card}
                index={index}
                onDone={onDone}
                timerState={timerStates[card.key] ?? null}
                nowMs={nowMs}
                clockworkBase={clockworkTotals[card.key] ?? 0}
                onRefreshClockwork={() => onRefreshClockwork(card.key)}

              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function UserKanbanClient({
  userId,
  data,
}: {
  userId: string
  data: UserKanbanData
}) {
  const [cards, setCards] = React.useState<UserKanbanCard[]>(
    data.ok ? data.cards : []
  )
  const [pendingDone, setPendingDone] = React.useState<UserKanbanCard | null>(null)
  const [pendingInApproval, setPendingInApproval] = React.useState<UserKanbanCard | null>(null)
  /** Tracks in-flight API calls per issueKey — prevents double-move for the same card
   *  without blocking drags of other cards. Scoped to component instance (not module-level). */
  const inFlight = React.useRef(new Set<string>())
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<UserKanbanColumn>>(new Set())

  // ── Timer state ──────────────────────────────────────────────────────────────
  const [timerStates, setTimerStates] = React.useState<Record<string, TimerState>>({})
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const [clockworkTotals, setClockworkTotals] = React.useState<Record<string, number>>({})

  // Tick a cada segundo para atualizar o display dos timers
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Carrega timers existentes para cards em "Em andamento" após o mount
  React.useEffect(() => {
    if (!data.ok) return
    const inProgressKeys = data.cards
      .filter((c) => c.column === "in_progress")
      .map((c) => c.key)
    if (inProgressKeys.length === 0) return

    getActiveTimersForCards(inProgressKeys)
      .then((states) => {
        const map: Record<string, TimerState> = {}
        for (const s of states) map[s.issueKey] = s
        setTimerStates(map)
      })
      .catch(() => null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Carrega totais do Clockwork para todos os cards visíveis após o mount
  React.useEffect(() => {
    if (!data.ok) return
    const allKeys = data.cards.map((c) => c.key)
    if (allKeys.length === 0) return

    getClockworkTotalsForCards(allKeys)
      .then(setClockworkTotals)
      .catch(() => null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Load hidden columns from localStorage after mount (SSR-safe).
  // Sentinel: if no entry exists for this user, default to hiding Pausado/Aguardando/Cancelado.
  // If an entry exists (even an empty array), respect the saved preference.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY(userId))
      if (stored === null) {
        // First visit — apply defaults and persist them
        setHiddenColumns(new Set(DEFAULT_HIDDEN))
        localStorage.setItem(LS_KEY(userId), JSON.stringify(DEFAULT_HIDDEN))
      } else {
        const parsed = JSON.parse(stored) as string[]
        const valid = parsed.filter((c): c is UserKanbanColumn => HIDEABLE_COLS.has(c as UserKanbanColumn))
        setHiddenColumns(new Set(valid))
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleRefreshClockwork(issueKey: string) {
    const totals = await getClockworkTotalsForCards([issueKey]).catch(() => null)
    if (totals) setClockworkTotals((prev) => ({ ...prev, ...totals }))
  }

  function toggleColumn(colId: UserKanbanColumn) {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      try { localStorage.setItem(LS_KEY(userId), JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const memberName = data.ok ? data.memberName : "Usuário"

  // Group cards by column
  const cardsByColumn = React.useMemo(() => {
    const map: Record<UserKanbanColumn, UserKanbanCard[]> = {
      backlog: [], in_progress: [], paused: [], waiting: [],
      in_approval: [], done: [], canceled: [],
    }
    for (const card of cards) {
      const col = card.column
      if (col in map) map[col].push(card)
    }
    // Sort within each column
    for (const col of Object.keys(map) as UserKanbanColumn[]) {
      map[col] = sortCards(map[col])
    }
    return map
  }, [cards])

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId: issueKey } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId) return

    const srcCol = source.droppableId as UserKanbanColumn
    const dstCol = destination.droppableId as UserKanbanColumn

    const card = cards.find((c) => c.key === issueKey)
    if (!card) return
    // Prevent double-move for the same card while its API call is in flight
    if (inFlight.current.has(issueKey)) return

    // Cards already in Canceled cannot be moved
    if (srcCol === "canceled") {
      toast.error("Cards cancelados não podem ser movidos.")
      return
    }

    // Done cards can only be moved to Cancelado (e.g. to correct a mistake)
    if (srcCol === "done" && dstCol !== "canceled") {
      toast.error("Cards concluídos só podem ser movidos para 'Cancelado'.")
      return
    }

    // UX Tarefas must pass through "Em aprovação" before being marked as done
    if (dstCol === "done" && card.cardType === "ux_tarefa" && srcCol !== "in_approval") {
      toast.error("Para concluir uma tarefa, ela precisa passar antes pela coluna 'Em aprovação'.")
      return
    }

    // Done requires confirmation modal
    if (dstCol === "done") {
      setPendingDone({ ...card, column: dstCol })
      return
    }

    // In Approval requires mandatory approver selection
    if (dstCol === "in_approval") {
      setPendingInApproval({ ...card, column: dstCol })
      return
    }

    // Optimistic update
    const prev = cards
    setCards((c) =>
      c.map((x) => x.key === issueKey ? { ...x, column: dstCol } : x)
    )

    // ── Timer: iniciar/parar conforme origem e destino ──────────────────────
    if (dstCol === "in_progress") {
      // Optimistic: mostra o timer imediatamente sem esperar a server action
      setTimerStates((prev) => ({
        ...prev,
        [issueKey]: { issueKey, startedAt: Date.now(), accumulatedSeconds: 0 },
      }))
      // Reconcilia com os valores confirmados pelo servidor (ex: sessão anterior pausada)
      startCardTimer(issueKey, card.summary)
        .then((res) => {
          if (res.ok && res.timer) {
            setTimerStates((prev) => ({ ...prev, [issueKey]: res.timer! }))
          }
        })
        .catch(() => null)
    } else if (srcCol === "in_progress") {
      // Saindo de "Em andamento": parar timer
      stopCardTimer(issueKey).catch(() => null)
      setTimerStates((prev) => {
        const next = { ...prev }
        delete next[issueKey]
        return next
      })
    }

    inFlight.current.add(issueKey)
    moveCardInUserKanban(issueKey, card.cardType, dstCol)
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error ?? "Erro ao mover card.")
          setCards(prev)
          // Reverter timer na UI se o movimento falhou
          if (dstCol === "in_progress") {
            setTimerStates((p) => { const n = { ...p }; delete n[issueKey]; return n })
          }
        }
      })
      .catch(() => {
        setCards(prev)
        toast.error("Erro ao mover card. Tente novamente.")
      })
      .finally(() => { inFlight.current.delete(issueKey) })
  }

  async function handleDoneConfirm(mention: MentionUser | null) {
    if (!pendingDone) return
    const card = pendingDone

    // Para o timer se o card estava em "Em andamento" antes do modal abrir
    if (timerStates[card.key]) {
      stopCardTimer(card.key).catch(() => null)
      setTimerStates((p) => { const n = { ...p }; delete n[card.key]; return n })
    }

    try {
      const res = await completeCardDone(
        card.key,
        card.cardType,
        mention?.accountId ?? null,
        mention?.displayName ?? null,
        card.reporterAccountId,
        card.reporterDisplayName,
      )
      if (!res.ok) {
        toast.error(res.error ?? "Erro ao finalizar card.")
        return
      }
      toast.success(`Card ${card.key} entregue! 🎉`)
      setCards((c) => c.map((x) => x.key === card.key ? { ...x, column: "done" as const } : x))
    } catch {
      toast.error("Erro inesperado. Tente novamente.")
    } finally {
      setPendingDone(null)
    }
  }

  async function handleInApprovalConfirm(approver: MentionUser, prototypeLink?: string) {
    if (!pendingInApproval) return
    const card = pendingInApproval
    const prev = cards

    // Para o timer se o card estava em "Em andamento"
    if (timerStates[card.key]) {
      stopCardTimer(card.key).catch(() => null)
      setTimerStates((p) => { const n = { ...p }; delete n[card.key]; return n })
    }

    // Optimistic update
    setCards((c) => c.map((x) => x.key === card.key ? { ...x, column: "in_approval" as const } : x))
    setPendingInApproval(null)

    try {
      const res = await confirmInApproval(
        card.key,
        card.cardType,
        approver.accountId,
        approver.displayName,
        prototypeLink,
      )
      if (!res.ok) {
        toast.error(res.error ?? "Erro ao enviar para aprovação.")
        setCards(prev)
      } else {
        toast.success(`Card ${card.key} enviado para aprovação.`)
      }
    } catch {
      toast.error("Erro inesperado. Tente novamente.")
      setCards(prev)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header: breadcrumb (left) + hidden-column chips (right) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          backHref="/kanban"
          items={[
            { label: "Kanban", href: "/kanban" },
            { label: memberName },
          ]}
        />
        {hiddenColumns.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {COLUMNS.filter((c) => hiddenColumns.has(c.id)).map((col) => {
              const count = cardsByColumn[col.id].length
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggleColumn(col.id)}
                  title="Exibir coluna novamente"
                  aria-label={`Exibir coluna ${col.label}`}
                  className={cn(
                    "inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                    col.chipClass,
                  )}
                >
                  <span>{col.label}{count > 0 ? ` (${count})` : ""}</span>
                  <X className="ml-1.5 size-3 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Error state */}
      {!data.ok && (
        data.error.includes("não configurad") ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>Credenciais Jira não configuradas. Configure em Configurações para visualizar os cards.</span>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{data.error}</span>
          </div>
        )
      )}

      {/* Board */}
      {data.ok && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto scrollbar-thin">
            {(() => {
              const visibleCols = COLUMNS.filter((c) => !hiddenColumns.has(c.id))
              return (
                <div
                  className="flex gap-3 pb-4"
                  style={{ minWidth: `${visibleCols.length * (256 + 12)}px` }}
                >
                  {visibleCols.map((col) => (
                    <KanbanColumnView
                      key={col.id}
                      col={col}
                      cards={cardsByColumn[col.id]}
                      onDone={setPendingDone}
                      onHide={HIDEABLE_COLS.has(col.id) ? () => toggleColumn(col.id) : undefined}
                      timerStates={timerStates}
                      nowMs={nowMs}
                      clockworkTotals={clockworkTotals}
                      onRefreshClockwork={handleRefreshClockwork}
                    />
                  ))}
                </div>
              )
            })()}
          </div>
        </DragDropContext>
      )}

      {/* Empty board */}
      {data.ok && data.cards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="text-sm text-text-disabled italic">
            Nenhum card atribuído a {memberName} no kanban principal.
          </p>
          <Link
            href="/kanban"
            className="cursor-pointer text-sm text-brand-primary hover:underline"
          >
            ← Voltar ao Kanban
          </Link>
        </div>
      )}

      {/* Done modal */}
      {pendingDone && (
        <DoneModal
          card={pendingDone}
          onConfirm={handleDoneConfirm}
          onClose={() => setPendingDone(null)}
        />
      )}

      {/* In Approval modal */}
      {pendingInApproval && (
        <InApprovalModal
          card={pendingInApproval}
          onConfirm={handleInApprovalConfirm}
          onClose={() => setPendingInApproval(null)}
        />
      )}
    </div>
  )
}
