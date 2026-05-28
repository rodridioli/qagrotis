"use client"

import React from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { AlertCircle, ArrowRight, ChevronDown, Flag, Search, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { JiraNotConfiguredCard } from "@/components/shared/JiraNotConfiguredCard"
import { cn } from "@/core/utils"
import type { KanbanResult, UxTarefasResult } from "@/features/kanban/actions/kanban"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { KanbanAssignments } from "@/features/kanban/actions/ux-kanban"
import {
  assignIssueToUser,
  assignTarefaToMember,
  returnTarefaToBacklog,
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

function CardContent({ issue }: { issue: KanbanIssue }) {
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
          className="text-sm font-bold text-blue-700 dark:text-blue-300 underline-offset-2 hover:underline"
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

function DraggableCard({ issue, index }: { issue: KanbanIssue; index: number }) {
  return (
    <Draggable draggableId={`demanda:${issue.key}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-card p-4",
            "cursor-grab select-none border-l-[3px] border-l-blue-500 dark:border-l-blue-400",
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

function DraggableTarefaCard({ tarefa, index }: { tarefa: UxTarefa; index: number }) {
  return (
    <Draggable draggableId={`tarefa:${tarefa.key}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={cn(
            "flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-card p-4",
            "cursor-grab select-none border-l-[3px] border-l-emerald-500",
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

// ─── Tarefas lane ─────────────────────────────────────────────────────────────

function TarefasLane({
  tarefas,
  tagFilter,
  onTagFilterChange,
  tags,
  hasUntagged,
}: {
  tarefas: UxTarefa[]
  tagFilter: string
  onTagFilterChange: (v: string) => void
  tags: string[]
  hasUntagged: boolean
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
        {(tags.length > 0 || hasUntagged) && (
          <div className="relative ml-auto">
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
}: {
  droppableId: string
  member: EquipeMembroLancamentos
  issues: KanbanIssue[]
  tarefas: UxTarefa[]
  onOpenUserKanban: () => void
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
              <DraggableCard key={issue.key} issue={issue} index={index} />
            ))}
            {/* UX Tarefas in member column — draggable back to Tarefas */}
            {tarefas.map((tarefa, index) => (
              <DraggableTarefaCard key={tarefa.key} tarefa={tarefa} index={displayedIssues.length + index} />
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
}

// Drag-lock: prevents concurrent Jira API calls from overlapping drags
let dragLocked = false

export function UxKanbanClient({ initialResult, members, initialAssignments, initialTarefasResult }: Props) {
  const router = useRouter()
  const [assignments, setAssignments] = React.useState<KanbanAssignments>(initialAssignments)
  const [projectFilter, setProjectFilter] = React.useState<string>("")
  const [tagFilter, setTagFilter] = React.useState<string>("")
  // Split tarefas into: unassigned (shown in Tarefas column) and assigned (shown in member columns)
  const [tarefas, setTarefas] = React.useState<UxTarefa[]>(() => {
    if (!initialTarefasResult.ok) return []
    return initialTarefasResult.tarefas.filter(
      (t) => !initialAssignments[t.key] || initialAssignments[t.key].cardType !== "ux_tarefa",
    )
  })
  // memberTarefas: UX Tarefas currently in a member's main-kanban column
  const [memberTarefas, setMemberTarefas] = React.useState<Record<string, UxTarefa[]>>(() => {
    if (!initialTarefasResult.ok) return {}
    const map: Record<string, UxTarefa[]> = {}
    for (const tarefa of initialTarefasResult.tarefas) {
      const assignment = initialAssignments[tarefa.key]
      if (assignment?.cardType === "ux_tarefa") {
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

  // Per-member demanda issues
  const userIssues = React.useMemo(() => {
    const map: Record<string, KanbanIssue[]> = {}
    for (const m of activeMembers) {
      map[m.userId] = sortByPriority(
        issues.filter((i) => assignments[i.key]?.userId === m.userId && assignments[i.key]?.cardType !== "ux_tarefa"),
      )
    }
    return map
  }, [issues, assignments, activeMembers])

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


    </div>
  )
}
