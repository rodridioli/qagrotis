export const dynamic = "force-dynamic"

import { resolveJiraCredentialsForRequest } from "@/lib/jira-credentials-db"
import { auth } from "@/lib/auth"
import { checkIsAdmin } from "@/lib/session"
import { redirect } from "next/navigation"
import { TarefasClient, type TarefaRow } from "./TarefasClient"
import { TAREFAS_ASSIGNEE_EMPTY } from "./jira-tarefas-constants"

type JiraIssue = {
  id: string
  key: string
  fields?: {
    summary?: string
    status?: { name?: string }
    assignee?: { displayName?: string; accountId?: string } | null
    priority?: { name?: string }
    issuetype?: { name?: string }
    updated?: string
  }
}

type JiraSearchJqlResponse = {
  issues?: JiraIssue[]
  isLast?: boolean
  /** Próxima página no enhanced search (substitui `startAt`). */
  nextPageToken?: string | null
}

const JIRA_SEARCH_FIELDS = ["summary", "status", "assignee", "priority", "issuetype", "updated"] as const
const JIRA_PAGE_SIZE = 100
/** Evita loop infinito / timeout em projetos enormes; pode aumentar se necessário. */
const JIRA_MAX_PAGES = 50

function pickParam(v: string | string[] | undefined): string {
  if (v == null) return ""
  return (Array.isArray(v) ? v[0] : v).trim()
}

/** Aspas JQL para strings (status, accountId de assignee). */
function jqlQuotedString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/**
 * Monta JQL no servidor para o total bater com o Jira ao filtrar status/responsável.
 * `assignee` na URL: vazio = todos; `_empty` = sem assignee; caso contrário = accountId.
 */
function buildUxJql(status?: string, assigneeParam?: string): string {
  const parts: string[] = ["project = UX"]
  const st = status?.trim()
  if (st) parts.push(`status = ${jqlQuotedString(st)}`)

  const ap = assigneeParam?.trim()
  if (ap === TAREFAS_ASSIGNEE_EMPTY) parts.push("assignee is EMPTY")
  else if (ap) parts.push(`assignee = ${jqlQuotedString(ap)}`)

  parts.push("ORDER BY updated DESC")
  return parts.join(" AND ")
}

async function fetchProjectStatusNames(
  jiraBaseUrl: string,
  credentials: string,
): Promise<string[]> {
  const res = await fetch(`${jiraBaseUrl}/rest/api/3/project/UX/statuses`, {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) return []

  const data = (await res.json()) as Array<{ statuses?: { name?: string }[] }>
  const names = new Set<string>()
  for (const block of Array.isArray(data) ? data : []) {
    for (const s of block.statuses ?? []) {
      if (s.name) names.add(s.name)
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"))
}

/**
 * Busca todas as páginas do enhanced search para o JQL informado.
 */
async function fetchAllUxIssues(
  jiraBaseUrl: string,
  credentials: string,
  jql: string,
): Promise<{ issues: JiraIssue[]; truncated: boolean; error: string }> {
  const all: JiraIssue[] = []
  let nextPageToken: string | undefined
  let truncated = false
  let pageIndex = 0

  while (pageIndex < JIRA_MAX_PAGES) {
    const body: Record<string, unknown> = {
      jql,
      maxResults: JIRA_PAGE_SIZE,
      fields: [...JIRA_SEARCH_FIELDS],
    }
    if (nextPageToken) body.nextPageToken = nextPageToken

    const response = await fetch(`${jiraBaseUrl}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      return {
        issues: all,
        truncated,
        error: `Não foi possível carregar as tarefas de UX no Jira (${response.status}). ${detail.slice(0, 180)}`,
      }
    }

    const payload = (await response.json()) as JiraSearchJqlResponse
    const batch = payload.issues ?? []
    all.push(...batch)

    const token = payload.nextPageToken?.trim()
    if (payload.isLast || !token) break

    if (pageIndex + 1 >= JIRA_MAX_PAGES) {
      truncated = true
      break
    }
    nextPageToken = token
    pageIndex++
  }

  return { issues: all, truncated, error: "" }
}

async function getUxTasksFromJira(
  userId: string,
  filters: { status: string; assignee: string },
) {
  const resolved = await resolveJiraCredentialsForRequest(userId, {})
  if (!resolved) {
    return {
      issues: [] as JiraIssue[],
      jiraBaseUrl: "",
      statusOptions: [] as string[],
      truncated: false,
      error: "Integração com Jira não configurada para este usuário. Configure em Configurações antes de acessar Tarefas.",
    }
  }

  const jiraBaseUrl = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")

  const [statusOptions, { issues, truncated, error }] = await Promise.all([
    fetchProjectStatusNames(jiraBaseUrl, credentials),
    fetchAllUxIssues(
      jiraBaseUrl,
      credentials,
      buildUxJql(filters.status || undefined, filters.assignee || undefined),
    ),
  ])

  return {
    issues,
    jiraBaseUrl,
    statusOptions,
    truncated,
    error,
  }
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; assignee?: string | string[] }>
}) {
  const [session, isAdmin, sp] = await Promise.all([auth(), checkIsAdmin(), searchParams])
  if (!isAdmin) redirect("/dashboard")
  const userId = session?.user?.id

  if (!userId) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Não foi possível identificar o usuário autenticado para consultar o Jira.
      </div>
    )
  }

  const urlStatus = pickParam(sp.status)
  const urlAssignee = pickParam(sp.assignee)

  const { issues, jiraBaseUrl, statusOptions, truncated, error } = await getUxTasksFromJira(userId, {
    status: urlStatus,
    assignee: urlAssignee,
  })

  const rows: TarefaRow[] = issues.map((issue) => {
    const acc = issue.fields?.assignee?.accountId?.trim()
    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields?.summary?.trim() || "—",
      status: issue.fields?.status?.name || "—",
      assignee: issue.fields?.assignee?.displayName || "Não atribuído",
      assigneeAccountId: acc && acc.length > 0 ? acc : null,
      priority: issue.fields?.priority?.name || "—",
      updatedAt: issue.fields?.updated || "",
    }
  })

  return (
    <TarefasClient
      rows={rows}
      jiraBaseUrl={jiraBaseUrl}
      error={error}
      truncated={truncated}
      truncatedMaxIssues={JIRA_PAGE_SIZE * JIRA_MAX_PAGES}
      urlStatus={urlStatus}
      urlAssignee={urlAssignee}
      statusOptionsFromProject={statusOptions}
    />
  )
}
