"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import { fetchKanbanSubtasks } from "@/features/qa/lib/jira-worklogs-fetch"
import type { KanbanIssue } from "@/features/qa/lib/jira-worklogs-fetch"

export type KanbanResult =
  | { ok: true; issues: KanbanIssue[] }
  | { ok: false; error: string }

export async function getKanbanSubtasks(): Promise<KanbanResult> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (!can(role, "menu.kanban")) {
    return { ok: false, error: "Acesso negado." }
  }

  const resolved = await resolveJiraCredentialsForRequest(session.user.id).catch(() => null)
  if (!resolved) {
    return { ok: false, error: "Credenciais Jira não configuradas. Acesse Configurações → Jira." }
  }

  const base = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")

  try {
    const issues = await fetchKanbanSubtasks(base, credentials)
    return { ok: true, issues }
  } catch {
    return { ok: false, error: "Erro ao buscar dados do Jira. Tente novamente." }
  }
}
