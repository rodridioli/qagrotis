"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { db } from "@/core/db"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import { jiraJson } from "@/features/qa/lib/jira-worklogs-fetch"

export type KanbanAssignments = Record<string, string> // issueKey → userId

export async function getKanbanAssignments(): Promise<KanbanAssignments> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return {}

  const rows = await db.kanbanAssignment.findMany()
  return Object.fromEntries(rows.map((r) => [r.issueKey, r.userId]))
}

export async function assignTarefaToMember(
  issueKey: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }
  if (!issueKey || !userId) return { ok: false, error: "Parâmetros inválidos." }

  // Resolve Jira credentials
  const resolved = await resolveJiraCredentialsForRequest(session.user.id).catch(() => null)
  if (!resolved) return { ok: false, error: "Credenciais Jira não configuradas." }
  const base = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")

  // Resolve member's Jira accountId from cache
  const cached = await db.jiraAccountIdCache.findUnique({ where: { userId } }).catch(() => null)
  if (!cached?.accountId) {
    return { ok: false, error: "accountId Jira não encontrado para este membro." }
  }
  const accountId = cached.accountId

  // Set assignee on Jira issue
  const assigneeRes = await jiraJson(
    `${base}/rest/api/3/issue/${issueKey}/assignee`,
    credentials,
    { method: "PUT", body: JSON.stringify({ accountId }) },
  )
  if (!assigneeRes.ok) {
    return { ok: false, error: "Erro ao definir responsável no Jira." }
  }

  // Fetch available transitions
  const transRes = await jiraJson<{ transitions: { id: string; name: string }[] }>(
    `${base}/rest/api/3/issue/${issueKey}/transitions`,
    credentials,
  )
  if (!transRes.ok || !transRes.data?.transitions) {
    return { ok: false, error: "Erro ao buscar transições do Jira." }
  }
  const transition = transRes.data.transitions.find(
    (t) => t.name.toLowerCase() === "pending ux",
  )
  if (!transition) {
    return { ok: false, error: "Transição 'Pending UX' não encontrada no workflow." }
  }

  // Execute transition
  const doTransition = await jiraJson(
    `${base}/rest/api/3/issue/${issueKey}/transitions`,
    credentials,
    { method: "POST", body: JSON.stringify({ transition: { id: transition.id } }) },
  )
  if (!doTransition.ok) {
    return { ok: false, error: "Erro ao transicionar status no Jira." }
  }

  return { ok: true }
}

export async function assignIssueToUser(
  issueKey: string,
  userId: string | null,
): Promise<{ ok: boolean }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false }

  if (!issueKey) return { ok: false }

  if (userId === null) {
    await db.kanbanAssignment.deleteMany({ where: { issueKey } })
  } else {
    await db.kanbanAssignment.upsert({
      where: { issueKey },
      create: { issueKey, userId },
      update: { userId },
    })
  }
  return { ok: true }
}
