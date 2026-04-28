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

type JiraSearchResponse = {
  issues?: JiraIssue[]
}

async function getUxTasksFromJira(userId: string) {
  const resolved = await resolveJiraCredentialsForRequest(userId, {})
  if (!resolved) {
    return {
      issues: [] as JiraIssue[],
      jiraBaseUrl: "",
      error: "Integração com Jira não configurada para este usuário. Configure em Configurações antes de acessar Tarefas.",
    }
  }

  const jiraBaseUrl = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")
  const jql = "project = UX ORDER BY updated DESC"
  /** Atlassian removeu GET `/rest/api/3/search` (410); usar enhanced search. */
  const response = await fetch(`${jiraBaseUrl}/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql,
      maxResults: 100,
      fields: ["summary", "status", "assignee", "priority", "issuetype", "updated"],
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    return {
      issues: [] as JiraIssue[],
      jiraBaseUrl,
      error: `Não foi possível carregar as tarefas de UX no Jira (${response.status}). ${detail.slice(0, 180)}`,
    }
  }

  const payload = (await response.json()) as JiraSearchResponse
  return {
    issues: payload.issues ?? [],
    jiraBaseUrl,
    error: "",
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

  const { issues, jiraBaseUrl, error } = await getUxTasksFromJira(userId)
  const rows: TarefaRow[] = issues.map((issue) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary?.trim() || "—",
    status: issue.fields?.status?.name || "—",
    assignee: issue.fields?.assignee?.displayName || "Não atribuído",
    priority: issue.fields?.priority?.name || "—",
    updatedAt: issue.fields?.updated || "",
  }))

  return <TarefasClient rows={rows} jiraBaseUrl={jiraBaseUrl} error={error} />
}
