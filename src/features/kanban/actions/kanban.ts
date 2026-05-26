"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import { fetchKanbanSubtasks, fetchUxTarefas } from "@/features/qa/lib/jira-worklogs-fetch"
import type { KanbanIssue, UxTarefa } from "@/features/qa/lib/jira-worklogs-fetch"

export type KanbanResult =
  | { ok: true; issues: KanbanIssue[] }
  | { ok: false; error: string }

export type UxTarefasResult =
  | { ok: true; tarefas: UxTarefa[] }
  | { ok: false; error: string }

async function resolveCredentials(userId: string) {
  const resolved = await resolveJiraCredentialsForRequest(userId).catch(() => null)
  if (!resolved) return null
  const base = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")
  return { base, credentials }
}

export async function getKanbanSubtasks(): Promise<KanbanResult> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (!can(role, "menu.kanban")) {
    return { ok: false, error: "Acesso negado." }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) {
    return { ok: false, error: "Credenciais Jira não configuradas. Acesse Configurações → Jira." }
  }

  try {
    const issues = await fetchKanbanSubtasks(creds.base, creds.credentials)
    return { ok: true, issues }
  } catch {
    return { ok: false, error: "Erro ao buscar dados do Jira. Tente novamente." }
  }
}

export async function getUxTarefas(): Promise<UxTarefasResult> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (!can(role, "menu.kanban")) {
    return { ok: false, error: "Acesso negado." }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) {
    return { ok: false, error: "Credenciais Jira não configuradas. Acesse Configurações → Jira." }
  }

  try {
    const tarefas = await fetchUxTarefas(creds.base, creds.credentials)
    return { ok: true, tarefas }
  } catch {
    return { ok: false, error: "Erro ao buscar tarefas UX do Jira." }
  }
}
