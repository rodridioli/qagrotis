"use client"

import React from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { AlertCircle, ChevronDown, User } from "lucide-react"
import { cn } from "@/core/utils"
import type { KanbanResult } from "@/features/kanban/actions/kanban"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { KanbanAssignments } from "@/features/kanban/actions/ux-kanban"
import { assignIssueToUser } from "@/features/kanban/actions/ux-kanban"
import type { KanbanIssue } from "@/features/kanban/kanban-constants"

// ─── Priority sort ────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
}

function priorityRank(p: string | null): number {
  return PRIORITY_RANK[p?.toLowerCase() ?? ""] ?? 99
}

function sortByPriority(issues: KanbanIssue[]): KanbanIssue[] {
  return [...issues].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority)
    if (pr !== 0) return pr
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
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
              <span className="text-xs font-medium text-text-secondary">{issue.priority}</span>
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
        <span className="text-sm text-brand-primary">{dateStr}</span>
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
  headerRight,
  emptyText,
  wide,
  memberAvatar,
}: {
  droppableId: string
  title: string
  issues: KanbanIssue[]
  headerRight?: React.ReactNode
  emptyText?: string
  wide?: boolean
  memberAvatar?: { url: string | null; name: string }
}) {
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
          {issues.length}
        </span>
        {headerRight && <div className="ml-auto shrink-0">{headerRight}</div>}
      </div>

      <div className="mx-4 h-px bg-border-default" />

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
            style={{ maxHeight: "calc(100dvh - 180px)" }}
          >
            {issues.length === 0 && !snapshot.isDraggingOver && (
              <p className="py-6 text-center text-xs italic text-text-disabled">
                {emptyText ?? "Nenhum item"}
              </p>
            )}
            {issues.map((issue, index) => (
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
}

export function UxKanbanClient({ initialResult, members, initialAssignments }: Props) {
  const [assignments, setAssignments] = React.useState<KanbanAssignments>(initialAssignments)
  const [projectFilter, setProjectFilter] = React.useState<string>("")

  const issues = initialResult.ok ? initialResult.issues : []

  // Unique project names for filter (Pendências only)
  const projectNames = React.useMemo(() => {
    const names = new Set(issues.map((i) => i.projectName).filter(Boolean))
    return [...names].sort()
  }, [issues])

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

  const totalCols = 1 + activeMembers.length

  return (
    <div className="flex flex-col">
      {/* Error */}
      {!initialResult.ok && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{initialResult.error}</span>
        </div>
      )}

      {/* Board */}
      {initialResult.ok && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <div
              className="flex gap-4 pt-2"
              style={{ minWidth: `${320 + activeMembers.length * (288 + 16)}px` }}
            >
              {/* Pendências — fixed first lane */}
              <Lane
                droppableId="pending"
                title="Demandas"
                issues={pendingIssues}
                wide
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
                        <option value="">Projeto</option>
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

              {/* One lane per active UX member */}
              {activeMembers.map((member) => (
                <Lane
                  key={member.userId}
                  droppableId={member.userId}
                  title={member.name}
                  issues={userIssues[member.userId] ?? []}
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
