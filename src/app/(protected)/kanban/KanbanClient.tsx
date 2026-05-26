import { AlertCircle, ChevronsRight, MinusCircle } from "lucide-react"
import { cn } from "@/core/utils"
import type { KanbanResult } from "@/features/kanban/actions/kanban"
import type { KanbanIssue } from "@/features/kanban/kanban-constants"

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T12:00:00Z")
  if (isNaN(d.getTime())) return null
  return `${d.getUTCDate()}/${MONTHS_PT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`
}

/**
 * "A > B > Title" → { prefix: "A > B >", title: "Title" }
 * "SEM - Painel"  → { prefix: null, title: "SEM - Painel" }
 */
function parseSummary(summary: string): { prefix: string | null; title: string } {
  if (summary.includes(" > ")) {
    const parts = summary.split(" > ")
    return {
      prefix: parts.slice(0, -1).join(" > ") + " >",
      title: parts[parts.length - 1]!.trim(),
    }
  }
  return { prefix: null, title: summary }
}

/**
 * Derives a short project label for display below the title:
 * - " > " summary: second-to-last path segment (e.g. "PRO" from "OUT > PRO > Title")
 * - " - " summary: first segment before " - " (e.g. "SEM" from "SEM - Painel")
 * - fallback: strip "Plataforma Agro - " prefix from projectName
 */
function extractProjectLabel(summary: string, projectName: string): string {
  if (summary.includes(" > ")) {
    const parts = summary.split(" > ")
    return parts.length >= 2 ? (parts[parts.length - 2] ?? "").trim() : ""
  }
  if (summary.includes(" - ")) {
    return summary.split(" - ")[0]!.trim()
  }
  return projectName.replace(/^Plataforma Agro - /, "")
}

function priorityDotColor(priority: string | null): string {
  const p = priority?.toLowerCase() ?? ""
  if (p === "highest") return "text-rose-500"
  if (p === "high")    return "text-orange-400"
  if (p === "medium")  return "text-amber-400"
  if (p === "low")     return "text-blue-400"
  return "text-slate-400"
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
        className="size-8 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
        colorClass,
      )}
      aria-label={name ?? ""}
    >
      {initials}
    </span>
  )
}

// ── JiraCard ──────────────────────────────────────────────────────────────────

function JiraCard({ issue }: { issue: KanbanIssue }) {
  const jiraUrl = `https://agrotis.atlassian.net/browse/${issue.key}`
  const { prefix, title } = parseSummary(issue.summary)
  const projectLabel = extractProjectLabel(issue.summary, issue.projectName)
  const dateStr = formatDate(issue.dueDate)
  const dotColor = priorityDotColor(issue.priority)
  const isPaused = issue.statusCategoryColor === "yellow"

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-card p-4 shadow-sm transition-shadow hover:shadow-md">

      {/* Breadcrumb prefix (e.g. "OUT > PRO >") */}
      {prefix && (
        <p className="truncate text-[11px] leading-none text-text-disabled">{prefix}</p>
      )}

      {/* Title */}
      <p className="text-sm font-semibold leading-snug text-text-primary line-clamp-3">
        {title || "—"}
      </p>

      {/* Project label + optional due date */}
      <div className="flex flex-col gap-0.5">
        {projectLabel && (
          <span className="text-xs text-text-secondary">{projectLabel}</span>
        )}
        {dateStr && (
          <span className="text-xs text-text-disabled">{dateStr}</span>
        )}
      </div>

      {/* Priority dots + status icon (left) · Avatar (right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {issue.priority && (
            <span className={cn("text-sm leading-none tracking-tighter", dotColor)}>
              {"●●●●"}
            </span>
          )}
          {isPaused
            ? <MinusCircle className="size-[18px] shrink-0 text-rose-500" />
            : <ChevronsRight className="size-[18px] shrink-0 text-rose-500" />
          }
        </div>
        <Avatar url={issue.assigneeAvatarUrl} name={issue.assigneeDisplayName} />
      </div>

      {/* Issue key link with checkbox icon */}
      <a
        href={jiraUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-brand-primary"
      >
        <svg
          className="size-3.5 shrink-0 text-brand-primary"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1.5" y="1.5" width="13" height="13" rx="2"
            stroke="currentColor" strokeWidth="1.5"
            fill="currentColor" fillOpacity="0.12"
          />
          <path
            d="M4.5 8l2.5 2.5 4.5-4.5"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        {issue.key}
      </a>
    </div>
  )
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({ projectName, issues }: { projectName: string; issues: KanbanIssue[] }) {
  // Show short name in header: "Plataforma Agro - REC" → "Agro REC", "UX" → "UX"
  const displayName = projectName.replace(/^Plataforma Agro - /, "Agro ")

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-border-default bg-surface-overlay">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span
          className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-text-primary"
          title={projectName}
        >
          {displayName}
        </span>
        <span className="shrink-0 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
          {issues.length}
        </span>
      </div>

      <div className="mx-4 h-px bg-border-default" />

      {/* Cards */}
      <div
        className="flex flex-col gap-3 overflow-y-auto p-4 scrollbar-thin"
        style={{ maxHeight: "calc(100dvh - 180px)" }}
      >
        {issues.map((issue) => <JiraCard key={issue.key} issue={issue} />)}
      </div>
    </div>
  )
}

// ── Group issues by project (only non-empty) ──────────────────────────────────

type ProjectGroup = { projectName: string; issues: KanbanIssue[] }

function groupByProject(result: KanbanResult): ProjectGroup[] {
  if (!result.ok) return []
  const map = new Map<string, ProjectGroup>()
  for (const issue of result.issues) {
    const key = issue.projectName || issue.projectKey
    if (!map.has(key)) {
      map.set(key, { projectName: key, issues: [] })
    }
    map.get(key)!.issues.push(issue)
  }
  // Sort alphabetically by project name
  return [...map.values()].sort((a, b) => a.projectName.localeCompare(b.projectName))
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function KanbanClient({ initialResult }: { initialResult: KanbanResult }) {
  const groups = groupByProject(initialResult)
  const totalCols = Math.max(groups.length, 1)

  return (
    <div className="flex flex-col">
      {/* Error state */}
      {!initialResult.ok && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{initialResult.error}</span>
        </div>
      )}

      {/* Empty state */}
      {initialResult.ok && groups.length === 0 && (
        <p className="py-16 text-center text-sm italic text-text-disabled">
          Nenhum Jira com situação UX encontrado.
        </p>
      )}

      {/* Board */}
      {initialResult.ok && groups.length > 0 && (
        <div className="overflow-x-auto">
          <div
            className="flex gap-4 pt-2"
            style={{ minWidth: `${totalCols * (288 + 16)}px` }}
          >
            {groups.map((g) => (
              <KanbanColumn key={g.projectName} projectName={g.projectName} issues={g.issues} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
