"use client"

import React from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { AlertCircle, ChevronDown, Flag, Search, User } from "lucide-react"
import { JiraNotConfiguredCard } from "@/components/shared/JiraNotConfiguredCard"
import { cn } from "@/core/utils"
import type { KanbanResult, UxTarefasResult } from "@/features/kanban/actions/kanban"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { KanbanAssignments } from "@/features/kanban/actions/ux-kanban"
import { assignIssueToUser, assignTarefaToMember } from "@/features/kanban/actions/ux-kanban"
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
  highest: 0,
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
}

const PRIORITY_PT: Record<string, string> = {
  highest:  "Crítica",
  critical: "Crítica",
  crítica:  "Crítica",
  high:     "Alta",
  alta:     "Alta",
  medium:   "Média",
  média:    "Média",
  low:      "Baixa",
  baixa:    "Baixa",
  lowest:   "Muito Baixa",
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
  "bg-violet-500","bg-blue-500","bg-emerald-500",
  "bg-rose-500","bg-amber-500","bg-cyan-600",
]

function Avatar({
  url,
  name,
  size = "md",
}: {
  url: string | null
  name: string | null
  size?: "sm" | "md" | "lg"
}) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"
  const colorClass = AVATAR_PALETTES[(initials.charCodeAt(0) ?? 0) % AVATAR_PALETTES.length]!
  const sizeClass = size === "sm" ? "size-6" : size === "lg" ? "size-9" : "size-8"

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name ?? ""} className={cn(sizeClass, "shrink-0 rounded-full object-cover")} />
    )
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

// ─── Card content ─────────────────────────────────────────────────────────────

function CardContent({ issue }: { issue: KanbanIssue }) {
  const jiraUrl = `https://agrotis.atlassian.net/browse/${issue.key}`
  const dateStr = formatDate(issue.dueDate)
  const shortProject = issue.projectName.replace(/^Plataforma Agro - /, "")

  return (
    <>
      {/* 1. Cabeçalho: chave do Jira (negrito) + prioridade (texto + ícone) */}
      <div className="flex items-center justify-between gap-2">
        <a
          href={jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-bold text-text-primary underline-offset-2 hover:underline"
        >
          {issue.key}
        </a>
        {(issue.priorityIconUrl ?? issue.priority) && (
          <div className="flex shrink-0 items-center gap-1">
            {issue.priority && (
              <span className="text-xs font-medium text-text-secondary">
                {translatePriority(issue.priority)}
              </span>
            )}
            {issue.priorityIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.priorityIconUrl} alt="" className="size-4 shrink-0" />
            )}
          </div>
        )}
      </div>

      {/* 2. Título */}
      <p className="text-sm leading-snug text-text-primary line-clamp-3">
        {issue.summary || "—"}
      </p>

      {/* 3. Data de entrega (somente se existir) */}
      {dateStr && (
        <div className="flex items-center gap-1">
          <Flag className="size-3 shrink-0 text-red-500" aria-hidden />
          <span className="text-xs text-brand-primary">{dateStr}</span>
        </div>
      )}

      {/* 4. Relator + badge do projeto */}
      <div className="flex items-center justify-between gap-2">
        {issue.reporterDisplayName ? (
          <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate underline underline-offset-2">{issue.reporterDisplayName}</span>
          </div>
        ) : (
          <div />
        )}
        {shortProject && (
          <span className="shrink-0 rounded border border-border-default bg-surface-card px-2 py-0.5 text-xs font-medium text-text-secondary">
            {shortProject}
          </span>
        )}
      </div>
    </>
  )
}

// ─── DraggableCard ────────────────────────────────────────────────────────────

function DraggableCard({ issue, index }: { issue: KanbanIssue; index: number }) {
  return (
    <Draggable draggableId={issue.key} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-card p-4",
            "cursor-grab select-none",
            "border-l-[3px] border-l-brand-primary",
            snapshot.isDragging
              ? "shadow-xl rotate-[0.5deg] opacity-90 scale-[1.01]"
              : "shadow-sm transition-shadow hover:shadow-md",
          )}
        >
          <CardContent issue={issue} />
        </div>
      )}
    </Draggable>
  )
}

// ─── Lane ─────────────────────────────────────────────────────────────────────

function Lane({
  droppableId,
  title,
  issues,
  tarefas,
  headerRight,
  emptyText,
  wide,
  memberAvatar,
  searchable,
}: {
  droppableId: string
  title: string
  issues: KanbanIssue[]
  tarefas?: UxTarefa[]
  headerRight?: React.ReactNode
  emptyText?: string
  wide?: boolean
  memberAvatar?: { url: string | null; name: string }
  searchable?: boolean
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

  const totalCount = displayedIssues.length + (tarefas?.length ?? 0)

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay",
        wide ? "w-80" : "w-72",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {memberAvatar && (
          <Avatar url={memberAvatar.url} name={memberAvatar.name} size="sm" />
        )}
        <span
          className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary"
          title={title}
        >
          {title}
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {totalCount}
        </span>
        {headerRight && <div className="ml-auto shrink-0">{headerRight}</div>}
      </div>

      <div className="mx-4 h-px bg-border-default" />

      {/* Search bar */}
      {searchable && (
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
      )}

      {/* Droppable */}
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-col gap-3 overflow-y-auto p-4 scrollbar-thin",
              "min-h-[80px] rounded-b-xl transition-colors duration-150",
              snapshot.isDraggingOver ? "bg-brand-primary/[0.04]" : "",
            )}
            style={{ maxHeight: searchable ? "calc(100dvh - 224px)" : "calc(100dvh - 180px)" }}
          >
            {totalCount === 0 && !snapshot.isDraggingOver && (
              <p className="py-6 text-center text-xs italic text-text-disabled">
                {debouncedSearch.trim()
                  ? "Nenhum resultado encontrado"
                  : (emptyText ?? "Nenhum item")}
              </p>
            )}
            {displayedIssues.map((issue, index) => (
              <DraggableCard key={issue.key} issue={issue} index={index} />
            ))}
            {provided.placeholder}
            {tarefas?.map((tarefa) => (
              <div
                key={tarefa.key}
                className="flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-card p-4 border-l-[3px] border-l-brand-primary shadow-sm"
              >
                <TarefaCardContent tarefa={tarefa} />
              </div>
            ))}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ─── Tarefa card content ──────────────────────────────────────────────────────

function TarefaCardContent({ tarefa }: { tarefa: UxTarefa }) {
  const jiraUrl = `https://agrotis.atlassian.net/browse/${tarefa.key}`
  const dateStr = formatDate(tarefa.deadline ?? tarefa.dueDate)

  return (
    <>
      {/* Cabeçalho: chave + prioridade */}
      <div className="flex items-center justify-between gap-2">
        <a
          href={jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-bold text-text-primary underline-offset-2 hover:underline"
        >
          {tarefa.key}
        </a>
        {(tarefa.priorityIconUrl ?? tarefa.priority) && (
          <div className="flex shrink-0 items-center gap-1">
            {tarefa.priority && (
              <span className="text-xs font-medium text-text-secondary">
                {translatePriority(tarefa.priority)}
              </span>
            )}
            {tarefa.priorityIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tarefa.priorityIconUrl} alt="" className="size-4 shrink-0" />
            )}
          </div>
        )}
      </div>

      {/* Título */}
      <p className="text-sm leading-snug text-text-primary line-clamp-3">
        {tarefa.summary || "—"}
      </p>

      {/* Data de entrega */}
      {dateStr && (
        <div className="flex items-center gap-1">
          <Flag className="size-3 shrink-0 text-red-500" aria-hidden />
          <span className="text-xs text-brand-primary">{dateStr}</span>
        </div>
      )}

      {/* Solicitante + tag */}
      <div className="flex items-center justify-between gap-2">
        {tarefa.solicitanteDisplayName ? (
          <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate underline underline-offset-2">{tarefa.solicitanteDisplayName}</span>
          </div>
        ) : (
          <div />
        )}
        {tarefa.tag && (
          <span className="shrink-0 rounded border border-border-default bg-surface-card px-2 py-0.5 text-xs font-medium text-text-secondary">
            {tarefa.tag}
          </span>
        )}
      </div>
    </>
  )
}

// ─── Draggable tarefa card ────────────────────────────────────────────────────

function DraggableTarefaCard({ tarefa, index }: { tarefa: UxTarefa; index: number }) {
  return (
    <Draggable draggableId={tarefa.key} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-card p-4",
            "cursor-grab select-none",
            "border-l-[3px] border-l-brand-primary",
            snapshot.isDragging
              ? "shadow-xl rotate-[0.5deg] opacity-90 scale-[1.01]"
              : "shadow-sm transition-shadow hover:shadow-md",
          )}
        >
          <TarefaCardContent tarefa={tarefa} />
        </div>
      )}
    </Draggable>
  )
}

// ─── Tarefas lane (draggable source, not a drop target) ───────────────────────

function TarefasLane({
  tarefas,
  tagFilter,
  onTagFilterChange,
  tags,
}: {
  tarefas: UxTarefa[]
  tagFilter: string
  onTagFilterChange: (v: string) => void
  tags: string[]
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
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary">
          Tarefas
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {displayedTarefas.length}
        </span>
        {tags.length > 0 && (
          <div className="relative ml-auto">
            <select
              value={tagFilter}
              onChange={(e) => onTagFilterChange(e.target.value)}
              className="appearance-none rounded-lg border border-border-default bg-surface-card py-1 pl-3 pr-7 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              aria-label="Filtrar por tag"
            >
              <option value="">Todos</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-text-secondary" />
          </div>
        )}
      </div>

      <div className="mx-4 h-px bg-border-default" />

      {/* Search bar */}
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

      {/* Droppable — isDropDisabled prevents drops into this column */}
      <Droppable droppableId="tarefas" isDropDisabled>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col gap-3 overflow-y-auto p-4 scrollbar-thin min-h-[80px] rounded-b-xl"
            style={{ maxHeight: "calc(100dvh - 224px)" }}
          >
            {displayedTarefas.length === 0 ? (
              <p className="py-6 text-center text-xs italic text-text-disabled">
                {debouncedSearch.trim()
                  ? "Nenhum resultado encontrado"
                  : tagFilter
                  ? "Nenhuma tarefa nesta tag"
                  : "Nenhuma tarefa"}
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

// ─── Root ─────────────────────────────────────────────────────────────────────

type Props = {
  initialResult: KanbanResult
  members: EquipeMembroLancamentos[]
  initialAssignments: KanbanAssignments
  initialTarefasResult: UxTarefasResult
}

export function UxKanbanClient({ initialResult, members, initialAssignments, initialTarefasResult }: Props) {
  const [assignments, setAssignments] = React.useState<KanbanAssignments>(initialAssignments)
  const [projectFilter, setProjectFilter] = React.useState<string>("")
  const [tagFilter, setTagFilter] = React.useState<string>("")
  const [tarefas, setTarefas] = React.useState<UxTarefa[]>(
    initialTarefasResult.ok ? initialTarefasResult.tarefas : [],
  )
  const [memberTarefas, setMemberTarefas] = React.useState<Record<string, UxTarefa[]>>({})

  const issues = initialResult.ok ? initialResult.issues : []
  const allTarefas = tarefas

  // Unique project names for Demandas filter
  const projectNames = React.useMemo(() => {
    const names = new Set(issues.map((i) => i.projectName).filter(Boolean))
    return [...names].sort()
  }, [issues])

  // Unique tags for Tarefas filter
  const tags = React.useMemo(() => {
    const set = new Set(allTarefas.map((t) => t.tag).filter((t): t is string => !!t))
    return [...set].sort()
  }, [allTarefas])

  // Tarefas filtered by tag, sorted by priority → deadline (nulos por último)
  const filteredTarefas = React.useMemo(
    () => sortTarefas(allTarefas.filter((t) => !tagFilter || t.tag === tagFilter)),
    [allTarefas, tagFilter],
  )

  // Active members only (exclude isInactive)
  const activeMembers = React.useMemo(
    () => members.filter((m) => !m.isInactive),
    [members],
  )

  // Pendências: unassigned issues, sorted by priority
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

  // Per-user issues, sorted by priority
  const userIssues = React.useMemo(() => {
    const map: Record<string, KanbanIssue[]> = {}
    for (const m of activeMembers) {
      map[m.userId] = sortByPriority(issues.filter((i) => assignments[i.key] === m.userId))
    }
    return map
  }, [issues, assignments, activeMembers])

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId: issueKey } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId) return

    // ── Tarefa card dragged from Tarefas column ──────────────────────────────
    if (source.droppableId === "tarefas") {
      // Only allow drop on member columns (not pending/tarefas)
      if (destination.droppableId === "pending" || destination.droppableId === "tarefas") return

      const memberId = destination.droppableId
      const tarefa = tarefas.find((t) => t.key === issueKey)
      if (!tarefa) return

      const prevTarefas = tarefas
      const prevMemberTarefas = memberTarefas

      // Optimistic: remove from Tarefas, add to member column
      setTarefas((prev) => prev.filter((t) => t.key !== issueKey))
      setMemberTarefas((prev) => ({
        ...prev,
        [memberId]: [...(prev[memberId] ?? []), tarefa],
      }))

      // Persist to Jira in background — revert both states on failure
      assignTarefaToMember(issueKey, memberId).catch(() => {
        setTarefas(prevTarefas)
        setMemberTarefas(prevMemberTarefas)
      })
      return
    }

    // ── Regular Demandas card drag between columns ───────────────────────────
    const newUserId =
      destination.droppableId === "pending" ? null : destination.droppableId

    // Optimistic update
    const prev = { ...assignments }
    setAssignments((a) => {
      const next = { ...a }
      if (newUserId === null) {
        delete next[issueKey]
      } else {
        next[issueKey] = newUserId
      }
      return next
    })

    // Persist in background — revert on failure
    assignIssueToUser(issueKey, newUserId).catch(() => {
      setAssignments(prev)
    })
  }

  return (
    <div className="flex flex-col">
      {/* Errors */}
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

      {/* Board */}
      {initialResult.ok && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <div
              className="flex gap-4 pt-2"
              style={{ minWidth: `${320 + 288 + 16 + activeMembers.length * (288 + 16)}px` }}
            >
              {/* Demandas — draggable, filterable by project, searchable */}
              <Lane
                droppableId="pending"
                title="Demandas"
                issues={pendingIssues}
                wide
                searchable
                emptyText={
                  projectFilter
                    ? "Nenhuma demanda neste projeto"
                    : "Nenhuma demanda"
                }
                headerRight={
                  projectNames.length > 0 ? (
                    <div className="relative">
                      <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        className="appearance-none rounded-lg border border-border-default bg-surface-card py-1 pl-3 pr-7 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        aria-label="Filtrar por projeto"
                      >
                        <option value="">Todos</option>
                        {projectNames.map((name) => (
                          <option key={name} value={name}>
                            {name.replace(/^Plataforma Agro - /, "")}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-text-secondary" />
                    </div>
                  ) : undefined
                }
              />

              {/* Tarefas — read-only, filterable by Tag */}
              <TarefasLane
                tarefas={filteredTarefas}
                tagFilter={tagFilter}
                onTagFilterChange={setTagFilter}
                tags={tags}
              />

              {/* One lane per active UX member */}
              {activeMembers.map((member) => (
                <Lane
                  key={member.userId}
                  droppableId={member.userId}
                  title={member.name}
                  issues={userIssues[member.userId] ?? []}
                  tarefas={memberTarefas[member.userId]}
                  memberAvatar={{ url: member.photoPath, name: member.name }}
                  emptyText="Arraste cards aqui"
                />
              ))}

              {activeMembers.length === 0 && (
                <div className="flex min-w-[288px] items-center justify-center rounded-xl border border-dashed border-border-default py-16">
                  <p className="text-xs italic text-text-disabled">
                    Nenhum membro UX ativo cadastrado
                  </p>
                </div>
              )}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Empty issues state */}
      {initialResult.ok && issues.length === 0 && (
        <p className="py-16 text-center text-sm italic text-text-disabled">
          Nenhum Jira com situação UX encontrado.
        </p>
      )}
    </div>
  )
}
