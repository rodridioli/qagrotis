"use client"

import * as React from "react"
import { RefreshCw, AlertCircle, ExternalLink, Plus } from "lucide-react"
import { cn } from "@/core/utils"
import { getKanbanSubtasks, type KanbanResult } from "@/features/kanban/actions/kanban"
import { KANBAN_PROJECT_NAMES, type KanbanIssue } from "@/features/kanban/kanban-constants"

// ── Colour helpers ────────────────────────────────────────────────────────────

function priorityBarColor(priority: string | null): string {
  const p = priority?.toLowerCase() ?? ""
  if (p === "highest") return "bg-red-500"
  if (p === "high")    return "bg-orange-500"
  if (p === "medium")  return "bg-amber-400"
  if (p === "low")     return "bg-blue-400"
  if (p === "lowest")  return "bg-slate-300"
  return "bg-slate-200"
}

function statusBadgeClass(colorName: string): string {
  switch (colorName) {
    case "green":  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
    case "yellow": return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
    case "blue":   return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
    default:       return "bg-surface-overlay text-text-secondary"
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  const initials = name
    ? name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()
    : "?"
  const colors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500",
    "bg-amber-500",  "bg-rose-500", "bg-cyan-500",
  ]
  const colorIdx = (initials.charCodeAt(0) ?? 0) % colors.length
  const colorClass = colors[colorIdx]!

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ""}
        className="size-9 rounded-full object-cover ring-2 ring-border-default shrink-0"
      />
    )
  }
  return (
    <span
      className={cn(
        "size-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-border-default",
        colorClass,
      )}
      aria-label={name ?? ""}
    >
      {initials}
    </span>
  )
}

// ── Jira-style Card ───────────────────────────────────────────────────────────

function JiraCard({ issue }: { issue: KanbanIssue }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-2 p-3">
        {/* Header: avatar + key + external link */}
        <div className="flex items-start gap-2.5">
          <Avatar url={issue.assigneeAvatarUrl} name={issue.assigneeDisplayName} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-sm text-text-primary leading-tight">
                {issue.key}
              </span>
              <a
                href={`https://agrosmart.atlassian.net/browse/${issue.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-text-disabled hover:text-brand-primary"
                title={`Abrir ${issue.key} no Jira`}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
            {issue.assigneeDisplayName && (
              <p className="truncate text-[10px] text-text-secondary leading-none mt-0.5">
                {issue.assigneeDisplayName}
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs text-text-primary leading-relaxed line-clamp-3">
          {issue.summary || "—"}
        </p>

        {/* Parent link */}
        {issue.parentKey && (
          <p
            className="truncate text-[10px] text-text-disabled"
            title={issue.parentSummary ?? issue.parentKey}
          >
            ↳ {issue.parentKey}
            {issue.parentSummary ? ` — ${issue.parentSummary}` : ""}
          </p>
        )}

        {/* Status badge */}
        <span
          className={cn(
            "self-start rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            statusBadgeClass(issue.statusCategoryColor),
          )}
        >
          {issue.status}
        </span>
      </div>

      {/* Priority colour bar at the bottom */}
      <div className={cn("h-1 w-full shrink-0 mt-auto", priorityBarColor(issue.priority))} />
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  projectName,
  issues,
}: {
  projectName: string
  issues: KanbanIssue[]
}) {
  const shortName = projectName.startsWith("Plataforma Agro - ")
    ? projectName.replace("Plataforma Agro - ", "Agro ")
    : projectName

  return (
    <div className="flex w-[17rem] shrink-0 flex-col rounded-xl bg-surface-overlay border border-border-default">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            className="truncate text-sm font-semibold text-text-primary"
            title={projectName}
          >
            {shortName}
          </h2>
          <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
            {issues.length}
          </span>
        </div>
        <button
          className="shrink-0 rounded p-0.5 text-text-disabled transition-colors hover:bg-surface-card hover:text-text-primary"
          aria-label={`Adicionar item em ${shortName}`}
          disabled
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="mx-3 h-px bg-border-default" />

      {/* Cards list */}
      <div
        className="flex flex-col gap-2.5 overflow-y-auto p-3 scrollbar-thin"
        style={{ maxHeight: "calc(100dvh - 220px)" }}
      >
        {issues.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-text-disabled">
            Nenhum item
          </p>
        ) : (
          issues.map((issue) => <JiraCard key={issue.key} issue={issue} />)
        )}
      </div>
    </div>
  )
}

// ── Root client component ─────────────────────────────────────────────────────

export function KanbanClient({ initialResult }: { initialResult: KanbanResult }) {
  const [result, setResult] = React.useState<KanbanResult>(initialResult)
  const [refreshing, setRefreshing] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date())

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const fresh = await getKanbanSubtasks()
      setResult(fresh)
      setLastUpdated(new Date())
    } finally {
      setRefreshing(false)
    }
  }

  const issuesByProject = React.useMemo<Record<string, KanbanIssue[]>>(() => {
    if (!result.ok) return {}
    const map: Record<string, KanbanIssue[]> = {}
    for (const name of KANBAN_PROJECT_NAMES) map[name] = []
    for (const issue of result.issues) {
      if (map[issue.projectName]) {
        map[issue.projectName]!.push(issue)
      } else {
        // fallback: match by project key prefix
        const found = KANBAN_PROJECT_NAMES.find((n) =>
          n.toUpperCase().includes(issue.projectKey.toUpperCase()),
        )
        const target = found ?? issue.projectName
        if (!map[target]) map[target] = []
        map[target]!.push(issue)
      }
    }
    return map
  }, [result])

  const totalIssues = result.ok ? result.issues.length : 0

  return (
    <div className="flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-4 border-b border-border-default px-2 pb-4">
        <div>
          <h1 className="text-base font-bold text-text-primary">Kanban UX/UI</h1>
          {result.ok && (
            <p className="mt-0.5 text-xs text-text-secondary">
              {totalIssues} {totalIssues !== 1 ? "subtarefas" : "subtarefa"} · atualizado às{" "}
              {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-surface-overlay disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4 shrink-0", refreshing && "animate-spin")} />
          {refreshing ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {/* Error */}
      {!result.ok && (
        <div className="m-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {/* Board — horizontal scroll */}
      {result.ok && (
        <div className="overflow-x-auto">
          <div
            className="flex gap-4 pt-4"
            style={{ minWidth: `${KANBAN_PROJECT_NAMES.length * (17 * 4 + 16)}px` }}
          >
            {KANBAN_PROJECT_NAMES.map((name) => (
              <KanbanColumn
                key={name}
                projectName={name}
                issues={issuesByProject[name] ?? []}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
