"use client"

import React from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { AlertCircle, ArrowRight, ChevronDown, Flag, Loader2, Plus, Search, User, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { JiraNotConfiguredCard } from "@/components/shared/JiraNotConfiguredCard"
import { cn } from "@/core/utils"
import type { KanbanResult, UxTarefasResult } from "@/features/kanban/actions/kanban"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { KanbanAssignments, UserKanbanColumn } from "@/features/kanban/actions/ux-kanban"
import {
  assignIssueToUser,
  assignTarefaToMember,
  returnTarefaToBacklog,
  createUxTarefa,
  searchJiraUsers,
} from "@/features/kanban/actions/ux-kanban"
import type { KanbanIssue, UxTarefa } from "@/features/kanban/kanban-constants"

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = {
  highest: 0, critical: 0, high: 1, medium: 2, low: 3, lowest: 4,
}

const PRIORITY_PT: Record<string, string> = {
  highest: "Crítica", critical: "Crítica", crítica: "Crítica",
  high: "Alta", alta: "Alta",
  medium: "Média", média: "Média",
  low: "Baixa", baixa: "Baixa",
  lowest: "Muito Baixa",
}

function translatePriority(priority: string | null): string | null {
  if (!priority) return null
  return PRIORITY_PT[priority.toLowerCase()] ?? priority
}

function priorityRank(p: string | null): number {
  return PRIORITY_RANK[p?.toLowerCase() ?? ""] ?? 99
}

function sortByPriority<T extends { priority: string | null; dueDate: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority)
    if (pr !== 0) return pr
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

function sortTarefas(items: UxTarefa[]): UxTarefa[] {
  return [...items].sort((a, b) => {
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

// ─── Jira status → user-kanban column (mirrors server-side mapping) ──────────

const UX_TAREFA_STATUS_MAP: Record<string, UserKanbanColumn> = {
  "in progress":   "in_progress",
  "ux writing":    "in_progress",
  "design system": "in_progress",
  "paused":        "paused",
  "waiting":       "waiting",
  "in approval":   "in_approval",
  "aprovação":     "in_approval",
  "delivered":     "done",
  "entregue":      "done",
  "canceled":      "canceled",
  "cancelado":     "canceled",
}

function tarefaStatusToColumn(status: string): UserKanbanColumn {
  return UX_TAREFA_STATUS_MAP[status.toLowerCase()] ?? "backlog"
}

// ─── Card helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T12:00:00Z")
  if (isNaN(d.getTime())) return null
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${d.getUTCFullYear()}`
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTES = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-rose-500", "bg-amber-500", "bg-cyan-600",
]

function Avatar({ url, name, size = "md" }: { url: string | null; name: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"
  const colorClass = AVATAR_PALETTES[(initials.charCodeAt(0) ?? 0) % AVATAR_PALETTES.length]!
  const sizeClass = size === "sm" ? "size-6" : size === "lg" ? "size-9" : "size-8"

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? ""} className={cn(sizeClass, "shrink-0 rounded-full object-cover")} />
  }
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", sizeClass, colorClass)}
      aria-label={name ?? ""}
    >
      {initials}
    </span>
  )
}

// ─── Demanda card content ─────────────────────────────────────────────────────

function CardContent({ issue, userColumn }: { issue: KanbanIssue; userColumn?: UserKanbanColumn }) {
  const jiraUrl = `https://agrotis.atlassian.net/browse/${issue.key}`
  const dateStr = formatDate(issue.dueDate)
  const shortProject = issue.projectName.replace(/^Plataforma Agro - /, "")

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <a
          href={jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "text-sm font-bold underline-offset-2 hover:underline",
            userColumn === "done"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-blue-700 dark:text-blue-300",
          )}
        >
          {issue.key}
        </a>
        {(issue.priorityIconUrl ?? issue.priority) && (
          <div className="flex shrink-0 items-center gap-1">
            {issue.priority && (
              <span className="text-xs font-medium text-text-secondary">{translatePriority(issue.priority)}</span>
            )}
            {issue.priorityIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.priorityIconUrl} alt="" className="size-4 shrink-0" />
            )}
          </div>
        )}
      </div>
      <p className="text-sm leading-snug text-text-primary line-clamp-3">{issue.summary || "—"}</p>
      {dateStr && (
        <div className="flex items-center gap-1">
          <Flag className="size-3 shrink-0 text-red-500" aria-hidden />
          <span className="text-xs text-red-500">{dateStr}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {issue.reporterDisplayName ? (
          <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate underline underline-offset-2">{issue.reporterDisplayName}</span>
          </div>
        ) : <div />}
        {shortProject && (
          <span className="shrink-0 rounded border border-border-default bg-surface-card px-2 py-0.5 text-xs font-medium text-text-secondary">
            {shortProject}
          </span>
        )}
      </div>
    </>
  )
}

function DraggableCard({ issue, index, userColumn }: { issue: KanbanIssue; index: number; userColumn?: UserKanbanColumn }) {
  const isCanceled = userColumn === "canceled"
  const isDone = userColumn === "done"
  return (
    <Draggable draggableId={`demanda:${issue.key}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2.5 rounded-xl border border-border-default p-4",
            "select-none border-l-[3px]",
            isCanceled
              ? "border-l-gray-300 bg-surface-card opacity-50 grayscale cursor-not-allowed"
              : isDone
              ? "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 cursor-grab"
              : "border-l-blue-500 dark:border-l-blue-400 bg-surface-card cursor-grab",
            snapshot.isDragging && !isCanceled
              ? "shadow-xl rotate-[0.5deg] opacity-90 scale-[1.01]"
              : isCanceled
              ? ""
              : "shadow-sm transition-shadow hover:shadow-md",
          )}
        >
          <CardContent issue={issue} userColumn={userColumn} />
        </div>
      )}
    </Draggable>
  )
}

// ─── UX Tarefa card content ───────────────────────────────────────────────────

function TarefaCardContent({ tarefa }: { tarefa: UxTarefa }) {
  const jiraUrl = `https://agrotis.atlassian.net/browse/${tarefa.key}`
  const dateStr = formatDate(tarefa.deadline ?? tarefa.dueDate)

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <a
          href={jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-bold text-emerald-600 dark:text-emerald-400 underline-offset-2 hover:underline"
        >
          {tarefa.key}
        </a>
        {(tarefa.priorityIconUrl ?? tarefa.priority) && (
          <div className="flex shrink-0 items-center gap-1">
            {tarefa.priority && (
              <span className="text-xs font-medium text-text-secondary">{translatePriority(tarefa.priority)}</span>
            )}
            {tarefa.priorityIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tarefa.priorityIconUrl} alt="" className="size-4 shrink-0" />
            )}
          </div>
        )}
      </div>
      <p className="text-sm leading-snug text-text-primary line-clamp-3">{tarefa.summary || "—"}</p>
      {dateStr && (
        <div className="flex items-center gap-1">
          <Flag className="size-3 shrink-0 text-red-500" aria-hidden />
          <span className="text-xs text-red-500">{dateStr}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {tarefa.solicitanteDisplayName ? (
          <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate underline underline-offset-2">{tarefa.solicitanteDisplayName}</span>
          </div>
        ) : <div />}
        {tarefa.tag && (
          <span className="shrink-0 rounded border border-border-default bg-surface-card px-2 py-0.5 text-xs font-medium text-text-secondary">
            {tarefa.tag}
          </span>
        )}
      </div>
    </>
  )
}

function DraggableTarefaCard({ tarefa, index, userColumn }: { tarefa: UxTarefa; index: number; userColumn?: UserKanbanColumn }) {
  const isCanceled = userColumn === "canceled"
  const isDone = userColumn === "done"
  return (
    <Draggable draggableId={`tarefa:${tarefa.key}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2.5 rounded-xl border border-border-default p-4",
            "select-none border-l-[3px] border-l-emerald-500",
            isCanceled
              ? "bg-surface-card opacity-50 grayscale cursor-not-allowed"
              : isDone
              ? "bg-emerald-50/70 dark:bg-emerald-950/20 cursor-grab"
              : "bg-surface-card cursor-grab",
            snapshot.isDragging && !isCanceled
              ? "shadow-xl rotate-[0.5deg] opacity-90 scale-[1.01]"
              : isCanceled
              ? ""
              : "shadow-sm transition-shadow hover:shadow-md",
          )}
        >
          <TarefaCardContent tarefa={tarefa} />
        </div>
      )}
    </Draggable>
  )
}

// ─── Create-Tarefa option constants ──────────────────────────────────────────

const TAREFA_PRIORITY_OPTIONS = [
  { value: "Medium",  label: "Média"   },
  { value: "High",    label: "Alta"    },
  { value: "Highest", label: "Crítica" },
  { value: "Low",     label: "Baixa"   },
] as const

const TAREFA_TYPE_OPTIONS = [
  { value: "Improvement",  label: "Melhoria"    },
  { value: "Adjust/Return", label: "Ajuste"     },
  { value: "New/Redesign", label: "Novo"        },
  { value: "Usability",    label: "Usabilidade" },
  { value: "Research",     label: "Pesquisa"    },
  { value: "Others",       label: "Outros"      },
] as const

// ─── Create Tarefa Modal ──────────────────────────────────────────────────────

type MentionUser = { accountId: string; displayName: string; avatarUrl: string | null }

function CreateTarefaModal({
  tags,
  onClose,
  onCreated,
}: {
  tags: string[]
  onClose: () => void
  onCreated: (tarefa: UxTarefa) => void
}) {
  const [summary,     setSummary]     = React.useState("")
  const [tag,         setTag]         = React.useState("")
  const [priority,    setPriority]    = React.useState("Medium")
  const [type,        setType]        = React.useState("")
  const [deadline,    setDeadline]    = React.useState("")
  const [solicitante, setSolicitante] = React.useState("")
  const [solicitanteAccountId, setSolicitanteAccountId] = React.useState<string | null>(null)
  const [description, setDescription] = React.useState("")
  const [files,       setFiles]       = React.useState<File[]>([])
  const [loading,     setLoading]     = React.useState(false)

  const [mentionUsers,   setMentionUsers]   = React.useState<MentionUser[]>([])
  const [mentionOpen,    setMentionOpen]    = React.useState(false)
  const [mentionLoading, setMentionLoading] = React.useState(false)
  const mentionDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const mentionRef      = React.useRef<HTMLDivElement>(null)
  const fileInputRef    = React.useRef<HTMLInputElement>(null)

  // Close mention dropdown on outside click
  React.useEffect(() => {
    if (!mentionOpen) return
    function handle(e: MouseEvent) {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [mentionOpen])

  function handleSolicitanteChange(value: string) {
    setSolicitante(value)
    setSolicitanteAccountId(null)

    const atIdx = value.lastIndexOf("@")
    if (atIdx === -1) { setMentionOpen(false); return }

    const query = value.slice(atIdx + 1).trim()
    if (mentionDebounce.current) clearTimeout(mentionDebounce.current)
    mentionDebounce.current = setTimeout(async () => {
      setMentionLoading(true)
      const res = await searchJiraUsers(query).catch(() => ({ ok: false as const }))
      setMentionLoading(false)
      if (res.ok && res.users && res.users.length > 0) {
        setMentionUsers(res.users)
        setMentionOpen(true)
      } else {
        setMentionOpen(false)
      }
    }, 300)
  }

  function selectMentionUser(user: MentionUser) {
    setSolicitante(user.displayName)
    setSolicitanteAccountId(user.accountId)
    setMentionOpen(false)
    setMentionUsers([])
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      const next = [...prev]
      for (const f of Array.from(incoming)) {
        if (!existing.has(f.name + f.size)) next.push(f)
      }
      return next
    })
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) { toast.error("Informe o título da tarefa."); return }
    if (!tag)            { toast.error("Selecione uma Tag."); return }
    if (!type)           { toast.error("Selecione o Tipo."); return }
    if (!priority)       { toast.error("Selecione a Prioridade."); return }
    setLoading(true)

    const fd = new FormData()
    fd.append("summary",  summary.trim())
    fd.append("tag",      tag)
    fd.append("priority", priority)
    fd.append("type",     type)
    if (deadline)    fd.append("deadline",    deadline)
    if (solicitante) fd.append("solicitante", solicitante.trim())
    if (solicitanteAccountId) fd.append("solicitanteAccountId", solicitanteAccountId)
    if (description) fd.append("description", description.trim())
    files.forEach((f, i) => fd.append(`attachment_${i}`, f, f.name))

    const res = await createUxTarefa(fd).catch(() => ({ ok: false as const, error: "Erro inesperado." }))
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error ?? "Erro ao criar tarefa.")
      return
    }

    if (res.error) toast.warning(res.error)
    else           toast.success(`Tarefa ${res.issueKey} criada com sucesso!`)

    const newTarefa: UxTarefa = {
      key:                    res.issueKey!,
      summary:                summary.trim(),
      status:                 "Open",
      priority:               priority || null,
      priorityIconUrl:        null,
      reporterDisplayName:    null,
      solicitanteDisplayName: solicitante.trim() || null,
      dueDate:                null,
      deadline:               deadline || null,
      tag:                    tag || null,
    }

    onCreated(newTarefa)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-border-default">
          <h2 className="text-base font-semibold text-text-primary">Nova Tarefa</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer shrink-0 rounded-lg p-1 text-text-secondary hover:bg-neutral-grey-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Descreva brevemente a tarefa…"
              className="w-full rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              required
            />
          </div>

          {/* Tag + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Tag <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className={cn(
                    "w-full appearance-none rounded-xl border bg-surface-input px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
                    tag ? "border-border-default text-text-primary" : "border-border-default text-text-disabled",
                  )}
                >
                  <option value="">— selecione —</option>
                  {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Prioridade <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-border-default bg-surface-input px-3 py-2 pr-7 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  {TAREFA_PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
              </div>
            </div>
          </div>

          {/* Tipo + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Tipo <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={cn(
                    "w-full appearance-none rounded-xl border bg-surface-input px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
                    type ? "border-border-default text-text-primary" : "border-border-default text-text-disabled",
                  )}
                >
                  <option value="">— selecione —</option>
                  {TAREFA_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          </div>

          {/* Solicitante — @mention */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Solicitante</label>
            <div className="relative" ref={mentionRef}>
              <input
                type="text"
                value={solicitante}
                onChange={(e) => handleSolicitanteChange(e.target.value)}
                placeholder="Digite @ para buscar um usuário…"
                autoComplete="off"
                className="w-full rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              {mentionLoading && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-secondary" />
              )}
              {mentionOpen && mentionUsers.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-lg">
                  {mentionUsers.map((u) => (
                    <li key={u.accountId}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectMentionUser(u) }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-neutral-grey-50"
                      >
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt="" className="size-6 shrink-0 rounded-full" />
                          : <User className="size-6 shrink-0 rounded-full text-text-secondary" />
                        }
                        <span className="truncate">{u.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os detalhes da tarefa…"
              rows={4}
              className="w-full resize-none rounded-xl border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Anexos</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-default py-3 text-sm text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary"
            >
              <Plus className="size-4" />
              Adicionar imagens ou PDFs
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = "" }}
            />
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-input px-3 py-1.5">
                    <span className="flex-1 truncate text-xs text-text-primary">{f.name}</span>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Remover ${f.name}`}
                      className="cursor-pointer shrink-0 rounded p-0.5 text-text-secondary hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="cursor-pointer rounded-xl border border-border-default bg-surface-card px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Criando…" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tarefas lane ─────────────────────────────────────────────────────────────

function TarefasLane({
  tarefas,
  tagFilter,
  onTagFilterChange,
  tags,
  hasUntagged,
  onCreateClick,
}: {
  tarefas: UxTarefa[]
  tagFilter: string
  onTagFilterChange: (v: string) => void
  tags: string[]
  hasUntagged: boolean
  onCreateClick: () => void
}) {
  const [rawSearch, setRawSearch] = React.useState("")
  const debouncedSearch = useDebounce(rawSearch, 200)

  const displayedTarefas = React.useMemo(() => {
    if (!debouncedSearch.trim()) return tarefas
    const q = debouncedSearch.trim().toLowerCase()
    return tarefas.filter(
      (t) => t.key.toLowerCase().includes(q) || (t.summary ?? "").toLowerCase().includes(q),
    )
  }, [tarefas, debouncedSearch])

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary">
          Tarefas
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {displayedTarefas.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(tags.length > 0 || hasUntagged) && (
            <div className="relative">
              <select
                value={tagFilter}
                onChange={(e) => onTagFilterChange(e.target.value)}
                className="appearance-none rounded-lg border border-border-default bg-surface-card py-1 pl-3 pr-7 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                aria-label="Filtrar por tag"
              >
                <option value="">Todos</option>
                <option value="__no_tag__">Sem tag</option>
                {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-text-secondary" />
            </div>
          )}
          <button
            type="button"
            onClick={onCreateClick}
            title="Nova tarefa"
            aria-label="Nova tarefa"
            className="flex cursor-pointer items-center justify-center rounded-lg border border-border-default bg-surface-card p-1.5 text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mx-4 h-px bg-border-default" />

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Buscar título ou código…"
            className="w-full rounded-lg border border-border-default bg-surface-input py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      {/* Tarefas column IS a valid drop target for returning assigned tarefas */}
      <Droppable droppableId="tarefas">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto p-4 scrollbar-thin rounded-b-xl transition-colors duration-150",
              snapshot.isDraggingOver ? "bg-emerald-500/[0.04]" : "",
            )}
          >
            {displayedTarefas.length === 0 && !snapshot.isDraggingOver ? (
              <p className="py-6 text-center text-xs italic text-text-disabled">
                {debouncedSearch.trim() ? "Nenhum resultado encontrado" : tagFilter ? "Nenhuma tarefa nesta tag" : "Nenhuma tarefa"}
              </p>
            ) : (
              displayedTarefas.map((tarefa, index) => (
                <DraggableTarefaCard key={tarefa.key} tarefa={tarefa} index={index} />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ─── Member lane ──────────────────────────────────────────────────────────────

function MemberLane({
  droppableId,
  member,
  issues,
  tarefas,
  onOpenUserKanban,
  searchable,
  columnStateMap,
}: {
  droppableId: string
  member: EquipeMembroLancamentos
  issues: KanbanIssue[]
  tarefas: UxTarefa[]
  onOpenUserKanban: () => void
  searchable?: boolean
  columnStateMap: Record<string, UserKanbanColumn>
}) {
  const [rawSearch, setRawSearch] = React.useState("")
  const debouncedSearch = useDebounce(rawSearch, 200)

  const displayedIssues = React.useMemo(() => {
    if (!debouncedSearch.trim()) return issues
    const q = debouncedSearch.trim().toLowerCase()
    return issues.filter(
      (i) => i.key.toLowerCase().includes(q) || (i.summary ?? "").toLowerCase().includes(q),
    )
  }, [issues, debouncedSearch])

  const totalCount = displayedIssues.length + tarefas.length

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay">
      <div className="flex items-center gap-2 px-4 py-3">
        <Avatar url={member.photoPath} name={member.name} size="sm" />
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary" title={member.name}>
          {member.name}
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {totalCount}
        </span>
        <button
          type="button"
          onClick={onOpenUserKanban}
          title={`Abrir kanban de ${member.name}`}
          aria-label={`Abrir kanban de ${member.name}`}
          className="ml-auto flex cursor-pointer items-center gap-1 rounded-full bg-brand-primary px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        >
          Ver
          <ArrowRight className="size-3" />
        </button>
      </div>

      <div className="mx-4 h-px bg-border-default" />

      {searchable && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border border-border-default bg-surface-input py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        </div>
      )}

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto p-4 scrollbar-thin rounded-b-xl transition-colors duration-150",
              snapshot.isDraggingOver ? "bg-brand-primary/[0.04]" : "",
            )}
          >
            {totalCount === 0 && !snapshot.isDraggingOver && (
              <p className="py-6 text-center text-xs italic text-text-disabled">
                {debouncedSearch.trim() ? "Nenhum resultado encontrado" : "Arraste cards aqui"}
              </p>
            )}
            {displayedIssues.map((issue, index) => (
              <DraggableCard
                key={issue.key}
                issue={issue}
                index={index}
                userColumn={columnStateMap[issue.key]}
              />
            ))}
            {/* UX Tarefas in member column — draggable back to Tarefas */}
            {tarefas.map((tarefa, index) => (
              <DraggableTarefaCard
                key={tarefa.key}
                tarefa={tarefa}
                index={displayedIssues.length + index}
                userColumn={tarefaStatusToColumn(tarefa.status)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ─── Demandas lane ────────────────────────────────────────────────────────────

function DemandasLane({
  issues,
  projectNames,
  projectFilter,
  onProjectFilterChange,
}: {
  issues: KanbanIssue[]
  projectNames: string[]
  projectFilter: string
  onProjectFilterChange: (v: string) => void
}) {
  const [rawSearch, setRawSearch] = React.useState("")
  const debouncedSearch = useDebounce(rawSearch, 200)

  const displayedIssues = React.useMemo(() => {
    if (!debouncedSearch.trim()) return issues
    const q = debouncedSearch.trim().toLowerCase()
    return issues.filter(
      (i) => i.key.toLowerCase().includes(q) || (i.summary ?? "").toLowerCase().includes(q),
    )
  }, [issues, debouncedSearch])

  return (
    <div className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary">
          Demandas
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {displayedIssues.length}
        </span>
        {projectNames.length > 0 && (
          <div className="relative ml-auto">
            <select
              value={projectFilter}
              onChange={(e) => onProjectFilterChange(e.target.value)}
              className="appearance-none rounded-lg border border-border-default bg-surface-card py-1 pl-3 pr-7 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              aria-label="Filtrar por projeto"
            >
              <option value="">Todos</option>
              {projectNames.map((name) => (
                <option key={name} value={name}>{name.replace(/^Plataforma Agro - /, "")}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-text-secondary" />
          </div>
        )}
      </div>

      <div className="mx-4 h-px bg-border-default" />

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Buscar título ou código…"
            className="w-full rounded-lg border border-border-default bg-surface-input py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <Droppable droppableId="pending">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto p-4 scrollbar-thin rounded-b-xl transition-colors duration-150",
              snapshot.isDraggingOver ? "bg-brand-primary/[0.04]" : "",
            )}
          >
            {displayedIssues.length === 0 && !snapshot.isDraggingOver && (
              <p className="py-6 text-center text-xs italic text-text-disabled">
                {debouncedSearch.trim() ? "Nenhum resultado encontrado" : projectFilter ? "Nenhuma demanda neste projeto" : "Nenhuma demanda"}
              </p>
            )}
            {displayedIssues.map((issue, index) => (
              <DraggableCard key={issue.key} issue={issue} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type Props = {
  initialResult: KanbanResult
  members: EquipeMembroLancamentos[]
  initialAssignments: KanbanAssignments
  initialTarefasResult: UxTarefasResult
  columnStateMap: Record<string, UserKanbanColumn>
}

// Drag-lock: prevents concurrent Jira API calls from overlapping drags
let dragLocked = false

export function UxKanbanClient({ initialResult, members, initialAssignments, initialTarefasResult, columnStateMap }: Props) {
  const router = useRouter()
  const [assignments, setAssignments] = React.useState<KanbanAssignments>(initialAssignments)
  const [projectFilter, setProjectFilter] = React.useState<string>("")
  const [tagFilter, setTagFilter] = React.useState<string>("")
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  // Split tarefas into: unassigned (shown in Tarefas column) and assigned (shown in member columns)
  const [tarefas, setTarefas] = React.useState<UxTarefa[]>(() => {
    if (!initialTarefasResult.ok) return []
    return initialTarefasResult.tarefas.filter(
      (t) => !initialAssignments[t.key] || initialAssignments[t.key].cardType !== "ux_tarefa",
    )
  })
  // memberTarefas: UX Tarefas currently in a member's main-kanban column
  // Terminal-state tarefas (done/canceled) are excluded — they only belong in the user's personal kanban
  const [memberTarefas, setMemberTarefas] = React.useState<Record<string, UxTarefa[]>>(() => {
    if (!initialTarefasResult.ok) return {}
    const map: Record<string, UxTarefa[]> = {}
    for (const tarefa of initialTarefasResult.tarefas) {
      const assignment = initialAssignments[tarefa.key]
      if (assignment?.cardType === "ux_tarefa") {
        const col = tarefaStatusToColumn(tarefa.status)
        if (col === "done" || col === "canceled") continue
        const uid = assignment.userId
        if (!map[uid]) map[uid] = []
        map[uid].push(tarefa)
      }
    }
    return map
  })

  const issues = initialResult.ok ? initialResult.issues : []

  // Build a Set of issue keys that are UX Tarefas (for drop restriction logic)
  const tarefaKeySet = React.useMemo(() => {
    const set = new Set<string>()
    for (const t of tarefas) set.add(t.key)
    for (const [, arr] of Object.entries(memberTarefas)) {
      for (const t of arr) set.add(t.key)
    }
    // Also include keys from DB assignments that are ux_tarefa type
    for (const [key, val] of Object.entries(assignments)) {
      if (val.cardType === "ux_tarefa") set.add(key)
    }
    return set
  }, [tarefas, memberTarefas, assignments])

  const projectNames = React.useMemo(() => {
    const names = new Set(issues.map((i) => i.projectName).filter(Boolean))
    return [...names].sort()
  }, [issues])

  const tags = React.useMemo(() => {
    const set = new Set(tarefas.map((t) => t.tag).filter((t): t is string => !!t))
    return [...set].sort()
  }, [tarefas])

  const hasUntagged = React.useMemo(() => tarefas.some((t) => !t.tag), [tarefas])

  const filteredTarefas = React.useMemo(
    () =>
      sortTarefas(
        tarefas.filter((t) => {
          if (!tagFilter) return true
          if (tagFilter === "__no_tag__") return !t.tag
          return t.tag === tagFilter
        }),
      ),
    [tarefas, tagFilter],
  )

  const activeMembers = React.useMemo(() => members.filter((m) => !m.isInactive), [members])

  // Pending demandas: unassigned AND from non-UX projects
  const pendingIssues = React.useMemo(
    () =>
      sortByPriority(
        issues.filter((i) => {
          if (assignments[i.key]) return false
          if (projectFilter && i.projectName !== projectFilter) return false
          return true
        }),
      ),
    [issues, assignments, projectFilter],
  )

  // Per-member demanda issues (excludes done/canceled — those only appear in the user's own kanban)
  const userIssues = React.useMemo(() => {
    const map: Record<string, KanbanIssue[]> = {}
    for (const m of activeMembers) {
      map[m.userId] = sortByPriority(
        issues.filter((i) => {
          if (assignments[i.key]?.userId !== m.userId) return false
          if (assignments[i.key]?.cardType === "ux_tarefa") return false
          const col = columnStateMap[i.key]
          if (col === "done" || col === "canceled") return false
          return true
        }),
      )
    }
    return map
  }, [issues, assignments, activeMembers, columnStateMap])

  function onDragEnd(result: DropResult) {
    if (dragLocked) return
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId) return

    // Parse draggable type from prefixed ID
    const isTarefa = draggableId.startsWith("tarefa:")
    const isDemanda = draggableId.startsWith("demanda:")
    const issueKey = draggableId.startsWith("tarefa:") || draggableId.startsWith("demanda:")
      ? draggableId.split(":").slice(1).join(":")
      : draggableId

    // ── TAREFA dragged from Tarefas column → member column ─────────────────────
    if (isTarefa && source.droppableId === "tarefas") {
      const destId = destination.droppableId
      // Block dropping to Demandas or back to Tarefas from Tarefas (no-op)
      if (destId === "pending" || destId === "tarefas") return

      const memberId = destId
      const tarefa = tarefas.find((t) => t.key === issueKey)
      if (!tarefa) return

      const prevTarefas = tarefas
      const prevMemberTarefas = memberTarefas
      const prevAssignments = assignments

      // Optimistic
      setTarefas((prev) => prev.filter((t) => t.key !== issueKey))
      setMemberTarefas((prev) => ({ ...prev, [memberId]: [...(prev[memberId] ?? []), tarefa] }))
      setAssignments((prev) => ({ ...prev, [issueKey]: { userId: memberId, cardType: "ux_tarefa" } }))

      dragLocked = true
      assignTarefaToMember(issueKey, memberId)
        .then((res) => {
          if (!res.ok) {
            toast.error(res.error ?? "Erro ao atribuir tarefa.")
            setTarefas(prevTarefas)
            setMemberTarefas(prevMemberTarefas)
            setAssignments(prevAssignments)
          }
        })
        .catch(() => {
          setTarefas(prevTarefas)
          setMemberTarefas(prevMemberTarefas)
          setAssignments(prevAssignments)
        })
        .finally(() => { dragLocked = false })
      return
    }

    // ── TAREFA dragged from member column → Tarefas column (return to backlog) ─
    if (isTarefa && destination.droppableId === "tarefas") {
      const sourceMemberId = source.droppableId
      const tarefa = memberTarefas[sourceMemberId]?.find((t) => t.key === issueKey)
      if (!tarefa) return

      const prevMemberTarefas = memberTarefas
      const prevTarefas = tarefas
      const prevAssignments = assignments

      // Optimistic: return to Tarefas column
      setMemberTarefas((prev) => ({
        ...prev,
        [sourceMemberId]: (prev[sourceMemberId] ?? []).filter((t) => t.key !== issueKey),
      }))
      setTarefas((prev) => sortTarefas([...prev, tarefa]))
      setAssignments((prev) => {
        const next = { ...prev }
        delete next[issueKey]
        return next
      })

      dragLocked = true
      returnTarefaToBacklog(issueKey)
        .then((res) => {
          if (!res.ok) {
            toast.error(res.error ?? "Erro ao retornar tarefa.")
            setMemberTarefas(prevMemberTarefas)
            setTarefas(prevTarefas)
            setAssignments(prevAssignments)
          }
        })
        .catch(() => {
          setMemberTarefas(prevMemberTarefas)
          setTarefas(prevTarefas)
          setAssignments(prevAssignments)
        })
        .finally(() => { dragLocked = false })
      return
    }

    // ── TAREFA between member columns ─────────────────────────────────────────
    if (isTarefa) {
      // Block tarefa from going to Demandas (rule 1.3)
      if (destination.droppableId === "pending") {
        toast.error("Tarefas UX não podem ir para Demandas.")
        return
      }
      const srcMemberId = source.droppableId
      const dstMemberId = destination.droppableId
      const tarefa = memberTarefas[srcMemberId]?.find((t) => t.key === issueKey)
      if (!tarefa) return

      const prevMemberTarefas = memberTarefas
      const prevAssignments = assignments

      // Optimistic: re-assign within member columns (re-assigning member)
      setMemberTarefas((prev) => ({
        ...prev,
        [srcMemberId]: (prev[srcMemberId] ?? []).filter((t) => t.key !== issueKey),
        [dstMemberId]: [...(prev[dstMemberId] ?? []), tarefa],
      }))
      setAssignments((prev) => ({ ...prev, [issueKey]: { userId: dstMemberId, cardType: "ux_tarefa" } }))

      dragLocked = true
      assignTarefaToMember(issueKey, dstMemberId)
        .then((res) => {
          if (!res.ok) {
            toast.error(res.error ?? "Erro ao mover tarefa.")
            setMemberTarefas(prevMemberTarefas)
            setAssignments(prevAssignments)
          }
        })
        .catch(() => {
          setMemberTarefas(prevMemberTarefas)
          setAssignments(prevAssignments)
        })
        .finally(() => { dragLocked = false })
      return
    }

    // ── DEMANDA logic ──────────────────────────────────────────────────────────
    if (isDemanda) {
      // Block UX project Demandas from going to Demandas column (rule 1.3)
      const issue = issues.find((i) => i.key === issueKey)
      if (issue && (issue.projectKey === "UX" || issue.projectName === "UX") && destination.droppableId === "pending") {
        toast.error("Cards do projeto UX não podem ir para Demandas.")
        return
      }

      const newUserId = destination.droppableId === "pending" ? null : destination.droppableId

      const prev = { ...assignments }
      setAssignments((a) => {
        const next = { ...a }
        if (newUserId === null) {
          delete next[issueKey]
        } else {
          next[issueKey] = { userId: newUserId, cardType: "demanda" }
        }
        return next
      })

      dragLocked = true
      assignIssueToUser(issueKey, newUserId)
        .then((res) => {
          if (!res.ok) {
            toast.error("Erro ao mover demanda.")
            setAssignments(prev)
          }
        })
        .catch(() => setAssignments(prev))
        .finally(() => { dragLocked = false })
    }
  }

  return (
    <div className="flex h-full flex-col">
      {!initialResult.ok && (
        initialResult.reason === "jira_not_configured" ? (
          <JiraNotConfiguredCard />
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{initialResult.error}</span>
          </div>
        )
      )}

      {initialResult.ok && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 min-h-0 overflow-x-auto scrollbar-thin">
            <div
              className="flex h-full gap-4 pt-2"
              style={{ minWidth: `${320 + 288 + 16 + activeMembers.length * (288 + 16)}px` }}
            >
              {/* Demandas */}
              <DemandasLane
                issues={pendingIssues}
                projectNames={projectNames}
                projectFilter={projectFilter}
                onProjectFilterChange={setProjectFilter}
              />

              {/* Tarefas UX */}
              <TarefasLane
                tarefas={filteredTarefas}
                tagFilter={tagFilter}
                onTagFilterChange={setTagFilter}
                tags={tags}
                hasUntagged={hasUntagged}
                onCreateClick={() => setShowCreateModal(true)}
              />

              {/* One lane per member */}
              {activeMembers.map((member) => (
                <MemberLane
                  key={member.userId}
                  droppableId={member.userId}
                  member={member}
                  issues={userIssues[member.userId] ?? []}
                  tarefas={memberTarefas[member.userId] ?? []}
                  onOpenUserKanban={() => router.push(`/kanban/usuario/${member.userId}`)}
                  columnStateMap={columnStateMap}
                />
              ))}

              {activeMembers.length === 0 && (
                <div className="flex min-w-[288px] items-center justify-center rounded-xl border border-dashed border-border-default py-16">
                  <p className="text-xs italic text-text-disabled">Nenhum membro UX ativo cadastrado</p>
                </div>
              )}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Create Tarefa modal */}
      {showCreateModal && (
        <CreateTarefaModal
          tags={tags}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newTarefa) => {
            setTarefas((prev) => sortTarefas([...prev, newTarefa]))
            setShowCreateModal(false)
          }}
        />
      )}
    </div>
  )
}
