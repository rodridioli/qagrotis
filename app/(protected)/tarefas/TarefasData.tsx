import { resolveJiraCredentialsForRequest } from "@/lib/jira-credentials-db"
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
  nextPageToken?: string | null
}

const JIRA_SEARCH_FIELDS = ["summary", "status", "assignee", "priority", "issuetype", "updated"] as const
const JIRA_PAGE_SIZE = 100
const JIRA_MAX_PAGES = 50

/** Aspas JQL para strings (status, accountId de assignee). */
function jqlQuotedString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function buildUxJql(status?: string, assigneeParam?: string): string {
  const clauses: string[] = ["project = UX"]
  const st = status?.trim()
  if (st) clauses.push(`status = ${jqlQuotedString(st)}`)

  const ap = assigneeParam?.trim()
  if (ap === TAREFAS_ASSIGNEE_EMPTY) clauses.push("assignee is EMPTY")
  else if (ap) clauses.push(`assignee = ${jqlQuotedString(ap)}`)

  return `${clauses.join(" AND ")} ORDER BY updated DESC`
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

interface TarefasDataProps {
  userId: string
  urlStatus: string
  urlAssignee: string
}

export async function TarefasData({ userId, urlStatus, urlAssignee }: TarefasDataProps) {
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
