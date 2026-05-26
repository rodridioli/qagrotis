"use client"

import * as React from "react"
import {
  RefreshCw,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  ChevronDown,
  ExternalLink,
  User,
} from "lucide-react"
import { cn } from "@/core/utils"
import { getKanbanSubtasks, KANBAN_PROJECT_NAMES, type KanbanIssue, type KanbanResult } from "@/features/kanban/actions/kanban"

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusStyle(colorName: string): { dot: string; badge: string } {
  switch (colorName) {
    case "green":     return { dot: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950" }
    case "yellow":    return { dot: "bg-amber-400",   badge: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950" }
    case "blue":      return { dot: "bg-blue-500",    badge: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950" }
    default:          return { dot: "bg-text-disabled", badge: "text-text-secondary bg-surface-overlay" }
  }
}

function PriorityIcon({ priority }: { priority: string | null }) {
  const p = priority?.toLowerCase() ?? ""
  if (p === "highest") return <AlertCircle className="size-3 text-red-500" aria-label="Highest" />
  if (p === "high")    return <ArrowUp      className="size-3 text-orange-500" aria-label="High" />
  if (p === "medium")  return <Minus        className="size-3 text-amber-500" aria-label="Medium" />
  if (p === "low")     return <ArrowDown    className="size-3 text-blue-400" aria-label="Low" />
  if (p === "lowest")  return <ChevronDown  className="size-3 text-blue-300" aria-label="Lowest" />
  return null
}

function Assignee({ url, name }: { url: string | null; name: string | null }) {
  if (!name) return null
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span className="flex items-center gap-1" title={name}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="size-5 rounded-full object-cover" />
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full bg-brand-primary/20 text-[9px] font-semibold text-brand-primary">
          {initials || <User className="size-3" />}
        </span>
      )}
      <span className="max-w-[80px] truncate text-[10px] text-text-secondary">{name.split(" ")[0]}</span>
    </span>
  )
}

// ── Jira Card ─────────────────────────────────────────────────────────────────

function JiraCard({ issue }: { issue: KanbanIssue }) {
  const { dot, badge } = statusStyle(issue.statusCategoryColor)

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border-default bg-surface-card p-3 shadow-card transition-shadow hover:shadow-md">
      {/* Top: issue type icon + issue key */}
      <div className="flex items-center gap-1.5">
        {issue.issueTypeIconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={issue.issueTypeIconUrl} alt="" className="size-3.5 shrink-0" aria-hidden />
        ) : null}
        <span className="font-mono text-[11px] font-semibold text-brand-primary">{issue.key}</span>
        <a
          href={`https://agrosmart.atlassian.net/browse/${issue.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 text-text-disabled hover:text-text-secondary"
          title="Abrir no Jira"
          aria-label={`Abrir ${issue.key} no Jira`}
        >
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Summary */}
      <p className="line-clamp-3 text-xs font-medium text-text-primary leading-snug">{issue.summary || "—"}</p>

      {/* Parent */}
      {issue.parentKey && (
        <p className="truncate text-[10px] text-text-disabled" title={issue.parentSummary ?? issue.parentKey}>
          ↳ {issue.parentKey}{issue.parentSummary ? ` — ${issue.parentSummary}` : ""}
        </p>
      )}

      {/* Status badge */}
      <span className={cn("inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none", badge)}>
        <span className={cn("size-1.5 rounded-full shrink-0", dot)} aria-hidden />
        {issue.status}
      </span>

      {/* Footer: priority + assignee */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <PriorityIcon priority={issue.priority} />
          {issue.priority && (
            <span className="text-[10px] text-text-secondary">{issue.priority}</span>
          )}
        </span>
        <Assignee url={issue.assigneeAvatarUrl} name={issue.assigneeDisplayName} />
      </div>
    </div>
  )
}

// ── Swimlane ──────────────────────────────────────────────────────────────────

function Swimlane({ projectName, issues }: { projectName: string; issues: KanbanIssue[] }) {
  return (
    <section className="rounded-xl border border-border-default bg-surface-base overflow-hidden">
      {/* Lane header */}
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-card px-4 py-2.5">
        <h2 className="text-sm font-semibold text-text-primary">{projectName}</h2>
        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
          {issues.length}
        </span>
      </div>

      {/* Cards row */}
      {issues.length === 0 ? (
        <p className="px-4 py-4 text-xs text-text-disabled italic">Nenhum item encontrado.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-thin">
          {issues.map((issue) => (
            <JiraCard key={issue.key} issue={issue} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Main client component ──────────────────────────────────────────────────────

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

  const issuesByProject = React.useMemo(() => {
    if (!result.ok) return {}
    const map: Record<string, KanbanIssue[]> = {}
    for (const name of KANBAN_PROJECT_NAMES) map[name] = []
    for (const issue of result.issues) {
      const bucket = map[issue.projectName]
      if (bucket) bucket.push(issue)
      else {
        // Issue cujo projectName não bateu exato — tenta via key prefix
        const found = KANBAN_PROJECT_NAMES.find(
          (n) => n.toUpperCase().includes(issue.projectKey.toUpperCase()),
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
    <div className="flex flex-col gap-5 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Kanban UX/UI</h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            {result.ok
              ? `${totalIssues} subtarefa${totalIssues !== 1 ? "s" : ""} encontrada${totalIssues !== 1 ? "s" : ""} • Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Subtarefas do tipo UX/UI por projeto"}
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-sm font-medium text-text-primary shadow-card transition-colors hover:bg-surface-overlay disabled:opacity-60",
          )}
          aria-label="Atualizar kanban"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          <span>{refreshing ? "Atualizando…" : "Atualizar"}</span>
        </button>
      </div>

      {/* Error state */}
      {!result.ok && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {/* Swimlanes */}
      {result.ok && (
        <div className="flex flex-col gap-4">
          {KANBAN_PROJECT_NAMES.map((projectName) => (
            <Swimlane
              key={projectName}
              projectName={projectName}
              issues={issuesByProject[projectName] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}
