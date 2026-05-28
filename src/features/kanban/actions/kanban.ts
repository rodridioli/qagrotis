"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  fetchKanbanSubtasks,
  fetchUxTarefas,
  fetchUxTarefasForUser,
  fetchIssueDetailsByKeys,
} from "@/features/qa/lib/jira-worklogs-fetch"
import type { KanbanIssue, UxTarefa } from "@/features/qa/lib/jira-worklogs-fetch"
import { db } from "@/core/db"

/** Jira statuses that map to "Done" or "Canceled" in the user kanban */
const TERMINAL_JIRA_STATUSES = new Set(["delivered", "canceled", "cancelado", "done"])

export type JiraErrorReason = "jira_not_configured" | "access_denied" | "fetch_error"

export type KanbanResult =
  | { ok: true; issues: KanbanIssue[] }
  | { ok: false; error: string; reason: JiraErrorReason }

export type UxTarefasResult =
  | { ok: true; tarefas: UxTarefa[] }
  | { ok: false; error: string; reason: JiraErrorReason }

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
    return { ok: false, error: "Acesso negado.", reason: "access_denied" }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) {
    return { ok: false, error: "Credenciais Jira não configuradas.", reason: "jira_not_configured" }
  }

  try {
    const issues = await fetchKanbanSubtasks(creds.base, creds.credentials)
    return { ok: true, issues }
  } catch {
    return { ok: false, error: "Erro ao buscar dados do Jira. Tente novamente.", reason: "fetch_error" }
  }
}

export async function getUxTarefas(): Promise<UxTarefasResult> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (!can(role, "menu.kanban")) {
    return { ok: false, error: "Acesso negado.", reason: "access_denied" }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) {
    return { ok: false, error: "Credenciais Jira não configuradas.", reason: "jira_not_configured" }
  }

  try {
    const tarefas = await fetchUxTarefas(creds.base, creds.credentials)
    return { ok: true, tarefas }
  } catch {
    return { ok: false, error: "Erro ao buscar tarefas UX do Jira.", reason: "fetch_error" }
  }
}

export async function getUxTarefasForUser(
  jiraAccountId: string,
): Promise<UxTarefasResult> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (!can(role, "menu.kanban")) {
    return { ok: false, error: "Acesso negado.", reason: "access_denied" }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) {
    return { ok: false, error: "Credenciais Jira não configuradas.", reason: "jira_not_configured" }
  }

  try {
    const tarefas = await fetchUxTarefasForUser(creds.base, creds.credentials, jiraAccountId)
    return { ok: true, tarefas }
  } catch {
    return { ok: false, error: "Erro ao buscar tarefas do usuário no Jira.", reason: "fetch_error" }
  }
}

/**
 * Fetches UX Tarefas for the main kanban, supplementing the standard JQL result
 * with any assigned-but-missing keys (e.g., cards moved to "In Progress" in a
 * user's kanban, or cards from non-UX projects assigned as ux_tarefa).
 *
 * Rule: show if NOT in a terminal Jira status (Delivered / Canceled / Done).
 */
export async function getUxTarefasForMainKanban(): Promise<UxTarefasResult> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (!can(role, "menu.kanban")) {
    return { ok: false, error: "Acesso negado.", reason: "access_denied" }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) {
    return { ok: false, error: "Credenciais Jira não configuradas.", reason: "jira_not_configured" }
  }

  try {
    // Fetch assigned ux_tarefa keys from DB and the standard tarefas JQL in parallel
    const [assignmentRows, tarefas] = await Promise.all([
      db.kanbanAssignment.findMany({ where: { cardType: "ux_tarefa" } }),
      fetchUxTarefas(creds.base, creds.credentials),
    ])

    const assignedKeys = assignmentRows.map((r) => r.issueKey)
    if (assignedKeys.length === 0) return { ok: true, tarefas }

    // Find which assigned keys are NOT already in the JQL result
    const fetchedKeySet = new Set(tarefas.map((t) => t.key.toUpperCase()))
    const missingKeys = assignedKeys.filter((k) => !fetchedKeySet.has(k.toUpperCase()))

    if (missingKeys.length === 0) return { ok: true, tarefas }

    // Fetch missing keys directly from Jira
    const detailsMap = await fetchIssueDetailsByKeys(creds.base, creds.credentials, missingKeys)

    for (const detail of detailsMap.values()) {
      // Skip terminal statuses (already done/canceled in the user's kanban)
      if (TERMINAL_JIRA_STATUSES.has(detail.jiraStatus.toLowerCase())) continue
      tarefas.push({
        key: detail.key,
        summary: detail.summary,
        status: detail.jiraStatus,
        priority: detail.priority,
        priorityIconUrl: detail.priorityIconUrl,
        dueDate: detail.dueDate,
        deadline: null,
        reporterDisplayName: detail.reporterDisplayName,
        solicitanteDisplayName: null,
        tag: null,
      })
    }

    return { ok: true, tarefas }
  } catch {
    return { ok: false, error: "Erro ao buscar tarefas UX do Jira.", reason: "fetch_error" }
  }
}
