import { AlertCircle, ExternalLink } from "lucide-react"
import { cn } from "@/core/utils"
import type { KanbanResult } from "@/features/kanban/actions/kanban"
import { KANBAN_PROJECT_NAMES, type KanbanIssue } from "@/features/kanban/kanban-constants"

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityBar(priority: string | null): string {
  const p = priority?.toLowerCase() ?? ""
  if (p === "highest") return "bg-red-500"
  if (p === "high")    return "bg-orange-400"
  if (p === "medium")  return "bg-amber-400"
  if (p === "low")     return "bg-blue-400"
  if (p === "lowest")  return "bg-slate-300"
  return "bg-border-default"
}

function statusClasses(colorName: string): string {
  switch (colorName) {
    case "green":  return "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800"
    case "yellow": return "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800"
    case "blue":   return "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-800"
    default:       return "bg-surface-overlay text-text-secondary ring-border-default"
  }
}

function priorityLabel(priority: string | null): string | null {
  if (!priority) return null
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase()
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"
  const palettes = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500",
    "bg-rose-500",   "bg-amber-500", "bg-cyan-600",
  ]
  const colorClass = palettes[(initials.charCodeAt(0) ?? 0) % palettes.length]!

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ""}
        className="size-10 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-surface-card"
      />
    )
  }
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white dark:ring-surface-card",
        colorClass,
      )}
      aria-label={name ?? ""}
    >
      {initials}
    </span>
  )
}

// ── Jira Card ─────────────────────────────────────────────────────────────────

function JiraCard({ issue }: { issue: KanbanIssue }) {
  const jiraUrl = `https://agrosmart.atlassian.net/browse/${issue.key}`

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex flex-col gap-3 p-4">

        {/* Row 1 — avatar + key (link) + assignee */}
        <div className="flex items-center gap-3">
          <Avatar url={issue.assigneeAvatarUrl} name={issue.assigneeDisplayName} />
          <div className="min-w-0 flex-1">
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-brand-primary hover:underline"
            >
              <span className="text-sm">{issue.key}</span>
              <ExternalLink className="size-3 opacity-60" />
            </a>
            {issue.assigneeDisplayName && (
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {issue.assigneeDisplayName}
              </p>
            )}
          </div>
        </div>

        {/* Row 2 — summary */}
        <p className="text-sm leading-relaxed text-text-primary line-clamp-3">
          {issue.summary || "—"}
        </p>

        {/* Row 3 — parent */}
        {issue.parentKey && (
          <p
            className="truncate text-xs text-text-disabled"
            title={issue.parentSummary ?? issue.parentKey}
          >
            ↳ {issue.parentKey}
            {issue.parentSummary ? ` — ${issue.parentSummary}` : ""}
          </p>
        )}

        {/* Row 4 — status + priority */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-block rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
              statusClasses(issue.statusCategoryColor),
            )}
          >
            {issue.status}
          </span>
          {issue.priority && (
            <span className="text-xs text-text-disabled">{priorityLabel(issue.priority)}</span>
          )}
        </div>
      </div>

      {/* Priority accent bar */}
      <div className={cn("h-1.5 w-full shrink-0", priorityBar(issue.priority))} />
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ projectName, issues }: { projectName: string; issues: KanbanIssue[] }) {
  const shortName = projectName.startsWith("Plataforma Agro - ")
    ? projectName.replace("Plataforma Agro - ", "Agro ")
    : projectName

  return (
    <div className="flex w-80 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-text-primary" title={projectName}>
          {shortName}
        </h2>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-semibold text-text-secondary">
          {issues.length}
        </span>
      </div>

      <div className="mx-4 h-px bg-border-default" />

      <div
        className="flex flex-col gap-3 overflow-y-auto p-4 scrollbar-thin"
        style={{ maxHeight: "calc(100dvh - 220px)" }}
      >
        {issues.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-text-disabled">Nenhum item</p>
        ) : (
          issues.map((issue) => <JiraCard key={issue.key} issue={issue} />)
        )}
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

function groupByProject(result: KanbanResult): Record<string, KanbanIssue[]> {
  if (!result.ok) return {}
  const map: Record<string, KanbanIssue[]> = {}
  for (const name of KANBAN_PROJECT_NAMES) map[name] = []
  for (const issue of result.issues) {
    if (map[issue.projectName]) {
      map[issue.projectName]!.push(issue)
    } else {
      const found = KANBAN_PROJECT_NAMES.find((n) =>
        n.toUpperCase().includes(issue.projectKey.toUpperCase()),
      )
      const target = found ?? issue.projectName
      if (!map[target]) map[target] = []
      map[target]!.push(issue)
    }
  }
  return map
}

export function KanbanClient({ initialResult }: { initialResult: KanbanResult }) {
  const issuesByProject = groupByProject(initialResult)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border-default px-2 pb-4">
        <h1 className="text-base font-bold text-text-primary">Kanban UX</h1>
      </div>

      {/* Error */}
      {!initialResult.ok && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{initialResult.error}</span>
        </div>
      )}

      {/* Board */}
      {initialResult.ok && (
        <div className="overflow-x-auto">
          <div
            className="flex gap-4 pt-4"
            style={{ minWidth: `${KANBAN_PROJECT_NAMES.length * (320 + 16)}px` }}
          >
            {KANBAN_PROJECT_NAMES.map((name) => (
              <KanbanColumn key={name} projectName={name} issues={issuesByProject[name] ?? []} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
