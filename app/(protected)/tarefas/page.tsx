export const dynamic = "force-dynamic"

import { resolveJiraCredentialsForRequest } from "@/lib/jira-credentials-db"
import { auth } from "@/lib/auth"
import { checkIsAdmin } from "@/lib/session"
import { redirect } from "next/navigation"
import { TarefasClient, type TarefaRow } from "./TarefasClient"

type JiraIssue = {
  id: string
  key: string
  fields?: {
    summary?: string
    status?: { name?: string }
    assignee?: { displayName?: string } | null
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

/**
 * Busca todas as páginas do enhanced search.
 * Importante: antes só íamos até 100 issues (`ORDER BY updated DESC`), então filtros no cliente
 * (ex.: status "Aprovação") subcontavam vs. o Jira, que considera todo o projeto.
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

async function getUxTasksFromJira(userId: string) {
  const resolved = await resolveJiraCredentialsForRequest(userId, {})
  if (!resolved) {
    return {
      issues: [] as JiraIssue[],
      jiraBaseUrl: "",
      truncated: false,
      error: "Integração com Jira não configurada para este usuário. Configure em Configurações antes de acessar Tarefas.",
    }
  }

  const jiraBaseUrl = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")
  const jql = "project = UX ORDER BY updated DESC"

  const { issues, truncated, error } = await fetchAllUxIssues(jiraBaseUrl, credentials, jql)
  return {
    issues,
    jiraBaseUrl,
    truncated,
    error,
  }
}

export default async function TarefasPage() {
  const [session, isAdmin] = await Promise.all([auth(), checkIsAdmin()])
  if (!isAdmin) redirect("/dashboard")
  const userId = session?.user?.id

  if (!userId) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Não foi possível identificar o usuário autenticado para consultar o Jira.
      </div>
    )
  }

  const { issues, jiraBaseUrl, truncated, error } = await getUxTasksFromJira(userId)
  const rows: TarefaRow[] = issues.map((issue) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary?.trim() || "—",
    status: issue.fields?.status?.name || "—",
    assignee: issue.fields?.assignee?.displayName || "Não atribuído",
    priority: issue.fields?.priority?.name || "—",
    updatedAt: issue.fields?.updated || "",
  }))

  return (
    <TarefasClient
      rows={rows}
      jiraBaseUrl={jiraBaseUrl}
      error={error}
      truncated={truncated}
      truncatedMaxIssues={JIRA_PAGE_SIZE * JIRA_MAX_PAGES}
    />
  )
}
