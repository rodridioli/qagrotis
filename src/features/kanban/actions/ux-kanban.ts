"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { db } from "@/core/db"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  jiraJson,
  buildAdfComment,
  postJiraComment,
  transitionIssueToStatus,
  searchJiraUsersForMention,
  fetchIssueDetailsByKeys,
  fetchUxTarefasForUser,
  type KanbanIssueDetail,
  type UxTarefa,
} from "@/features/qa/lib/jira-worklogs-fetch"

// ─── Types ────────────────────────────────────────────────────────────────────

export type KanbanAssignments = Record<string, { userId: string; cardType: "demanda" | "ux_tarefa" }>

export type UserKanbanColumn =
  | "backlog"
  | "in_progress"
  | "paused"
  | "waiting"
  | "in_approval"
  | "done"
  | "canceled"

export type UserKanbanCard = {
  key: string
  cardType: "ux_tarefa" | "demanda"
  summary: string
  jiraStatus: string
  priority: string | null
  priorityIconUrl: string | null
  dueDate: string | null
  deadline: string | null
  reporterDisplayName: string | null
  reporterAccountId: string | null
  solicitanteDisplayName: string | null
  tag: string | null
  projectName: string
  column: UserKanbanColumn
}

export type UserKanbanData = {
  ok: true
  cards: UserKanbanCard[]
  memberName: string
  jiraAccountId: string | null
} | {
  ok: false
  error: string
}

// ─── Jira status → per-user kanban column ────────────────────────────────────

const UX_TAREFA_STATUS_TO_COLUMN: Record<string, UserKanbanColumn> = {
  "in progress":   "in_progress",
  "ux writing":    "in_progress",
  "design system": "in_progress",
  "paused":        "paused",
  "waiting":       "waiting",
  "in approval":   "in_approval",
  "delivered":     "done",
  "canceled":      "canceled",
  "cancelado":     "canceled",
}

export function jiraStatusToColumn(status: string): UserKanbanColumn {
  return UX_TAREFA_STATUS_TO_COLUMN[status.toLowerCase()] ?? "backlog"
}

/** Maps per-user kanban column → Jira transition target name */
const COLUMN_TO_JIRA_STATUS: Record<UserKanbanColumn, string | null> = {
  backlog:      "Pending UX",
  in_progress:  "In Progress",
  paused:       "Paused",
  waiting:      "Waiting",
  in_approval:  "In Approval",
  done:         "Delivered",
  canceled:     "Canceled",
}

// ─── Credential resolver ──────────────────────────────────────────────────────

async function resolveCredentials(userId: string) {
  const resolved = await resolveJiraCredentialsForRequest(userId).catch(() => null)
  if (!resolved) return null
  const base = resolved.jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${resolved.jiraEmail}:${resolved.apiToken}`).toString("base64")
  return { base, credentials }
}

// ─── Main kanban: get assignments (now includes cardType) ─────────────────────

export async function getKanbanAssignments(): Promise<KanbanAssignments> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return {}

  const rows = await db.kanbanAssignment.findMany()
  return Object.fromEntries(
    rows.map((r) => [r.issueKey, { userId: r.userId, cardType: (r.cardType as "demanda" | "ux_tarefa") }])
  )
}

// ─── Main kanban: assign Demanda to a member ──────────────────────────────────

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
    await db.kanbanUserCardState.deleteMany({ where: { issueKey } })
    await db.kanbanInApprovalTracker.deleteMany({ where: { issueKey } })
  } else {
    await db.kanbanAssignment.upsert({
      where: { issueKey },
      create: { issueKey, userId, cardType: "demanda" },
      update: { userId, cardType: "demanda" },
    })
    // Initialise column state for this Demanda if not already set
    const existing = await db.kanbanUserCardState.findUnique({ where: { issueKey } })
    if (!existing) {
      await db.kanbanUserCardState.create({ data: { issueKey, userId, column: "backlog" } })
    }
  }
  return { ok: true }
}

// ─── Main kanban: assign UX Tarefa to member (sets Jira assignee + Pending UX) ─

export async function assignTarefaToMember(
  issueKey: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }
  if (!issueKey || !userId) return { ok: false, error: "Parâmetros inválidos." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  // Resolve member's Jira accountId from cache
  const cached = await db.jiraAccountIdCache.findUnique({ where: { userId } }).catch(() => null)
  if (!cached?.accountId) {
    return { ok: false, error: "accountId Jira não encontrado para este membro." }
  }
  const accountId = cached.accountId

  // Set assignee on Jira
  const assigneeRes = await jiraJson(
    `${base}/rest/api/3/issue/${issueKey}/assignee`,
    credentials,
    { method: "PUT", body: JSON.stringify({ accountId }) },
  )
  if (!assigneeRes.ok) return { ok: false, error: "Erro ao definir responsável no Jira." }

  // Transition to "Pending UX"
  const transResult = await transitionIssueToStatus(base, credentials, issueKey, "Pending UX")
  if (!transResult.ok) return { ok: false, error: transResult.error }

  // Persist assignment + initial column state
  await db.kanbanAssignment.upsert({
    where: { issueKey },
    create: { issueKey, userId, cardType: "ux_tarefa" },
    update: { userId, cardType: "ux_tarefa" },
  })

  return { ok: true }
}

// ─── Main kanban: return UX Tarefa to Tarefas column ─────────────────────────

export async function returnTarefaToBacklog(
  issueKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  // Keep Jira assignee (spec: "Manter responsável atual"); change status to Backlog
  const transResult = await transitionIssueToStatus(base, credentials, issueKey, "Backlog")
  // Non-fatal if transition fails (log but continue with DB cleanup)
  if (!transResult.ok) {
    console.warn("[kanban] returnTarefaToBacklog: transition failed for", issueKey, transResult.error)
  }

  // Remove from DB (card returns to Tarefas column on next fetch)
  await Promise.all([
    db.kanbanAssignment.deleteMany({ where: { issueKey } }),
    db.kanbanUserCardState.deleteMany({ where: { issueKey } }),
    db.kanbanInApprovalTracker.deleteMany({ where: { issueKey } }),
  ])

  return { ok: true }
}

// ─── Per-user kanban: load all cards for a member ────────────────────────────

export async function getUserKanbanData(userId: string): Promise<UserKanbanData> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  // Fetch assignments for this user
  const assignments = await db.kanbanAssignment.findMany({ where: { userId } })
  const tarefaKeys = assignments.filter((a) => a.cardType === "ux_tarefa").map((a) => a.issueKey)
  const demandaKeys = assignments.filter((a) => a.cardType === "demanda").map((a) => a.issueKey)

  // Fetch column states for Demandas
  const columnStates = await db.kanbanUserCardState.findMany({ where: { userId } })
  const columnMap = Object.fromEntries(columnStates.map((s) => [s.issueKey, s.column as UserKanbanColumn]))

  // Fetch member Jira accountId
  const jiraCache = await db.jiraAccountIdCache.findUnique({ where: { userId } }).catch(() => null)
  const jiraAccountId = jiraCache?.accountId ?? null

  // Fetch member name from DB
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { name: true },
  }).catch(() => null)
  const createdUser = !profile ? await db.createdUser.findUnique({
    where: { id: userId },
    select: { name: true },
  }).catch(() => null) : null
  const memberName = profile?.name ?? createdUser?.name ?? userId

  // Check and send In Approval reminders before returning data
  await _checkAndSendApprovalReminders(base, credentials, userId)

  // Fetch UX Tarefas by Jira assignee
  const tarefasFromJira: UxTarefa[] = jiraAccountId
    ? await fetchUxTarefasForUser(base, credentials, jiraAccountId).catch(() => [])
    : []

  // Also fetch any tarefaKeys that might not be in Jira result (edge cases)
  const tarefaDetailsMap = await fetchIssueDetailsByKeys(base, credentials, tarefaKeys).catch(() => new Map<string, KanbanIssueDetail>())

  // Build UxTarefa cards: use Jira assignee fetch as primary, fall back to key-based fetch
  const tarefaCards: UserKanbanCard[] = []
  const jiraTarefaKeys = new Set(tarefasFromJira.map((t) => t.key.toUpperCase()))

  for (const t of tarefasFromJira) {
    // Only include cards that are in our DB assignment list
    if (!tarefaKeys.includes(t.key)) continue
    tarefaCards.push({
      key: t.key,
      cardType: "ux_tarefa",
      summary: t.summary,
      jiraStatus: t.status,
      priority: t.priority,
      priorityIconUrl: t.priorityIconUrl,
      dueDate: t.dueDate,
      deadline: t.deadline,
      reporterDisplayName: t.reporterDisplayName,
      reporterAccountId: null, // not available in UxTarefa; will be enriched below if needed
      solicitanteDisplayName: t.solicitanteDisplayName,
      tag: t.tag,
      projectName: "UX",
      column: jiraStatusToColumn(t.status),
    })
  }

  // Fallback: keys in DB that weren't in Jira assignee result
  for (const key of tarefaKeys) {
    if (jiraTarefaKeys.has(key.toUpperCase())) continue
    const detail = tarefaDetailsMap.get(key.toUpperCase())
    if (!detail) continue
    tarefaCards.push({
      key: detail.key,
      cardType: "ux_tarefa",
      summary: detail.summary,
      jiraStatus: detail.jiraStatus,
      priority: detail.priority,
      priorityIconUrl: detail.priorityIconUrl,
      dueDate: detail.dueDate,
      deadline: null,
      reporterDisplayName: detail.reporterDisplayName,
      reporterAccountId: detail.reporterAccountId,
      solicitanteDisplayName: null,
      tag: null,
      projectName: detail.projectName,
      column: jiraStatusToColumn(detail.jiraStatus),
    })
  }

  // Fetch Demanda details by key
  const demandaDetailsMap = await fetchIssueDetailsByKeys(base, credentials, demandaKeys).catch(() => new Map<string, KanbanIssueDetail>())

  const demandaCards: UserKanbanCard[] = demandaKeys.flatMap((key) => {
    const detail = demandaDetailsMap.get(key.toUpperCase())
    if (!detail) return []
    return [{
      key: detail.key,
      cardType: "demanda" as const,
      summary: detail.summary,
      jiraStatus: detail.jiraStatus,
      priority: detail.priority,
      priorityIconUrl: detail.priorityIconUrl,
      dueDate: detail.dueDate,
      deadline: null,
      reporterDisplayName: detail.reporterDisplayName,
      reporterAccountId: detail.reporterAccountId,
      solicitanteDisplayName: null,
      tag: null,
      projectName: detail.projectName,
      column: columnMap[key] ?? "backlog",
    }]
  })

  return {
    ok: true,
    cards: [...tarefaCards, ...demandaCards],
    memberName,
    jiraAccountId,
  }
}

// ─── Per-user kanban: move a card between columns ─────────────────────────────

export async function moveCardInUserKanban(
  issueKey: string,
  cardType: "ux_tarefa" | "demanda",
  targetColumn: UserKanbanColumn,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  // Block Demandas from going to Canceled
  if (cardType === "demanda" && targetColumn === "canceled") {
    return { ok: false, error: "Demandas não podem ser canceladas." }
  }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  // Find which user this card belongs to (for tracker)
  const assignment = await db.kanbanAssignment.findUnique({ where: { issueKey } })
  const userId = assignment?.userId ?? ""

  // Handle In Approval entry/exit tracking
  if (targetColumn === "in_approval") {
    await _enterInApproval(base, credentials, issueKey, cardType, userId)
  } else {
    // Leaving in_approval or never was there — clean up tracker
    await db.kanbanInApprovalTracker.deleteMany({ where: { issueKey } }).catch(() => null)
  }

  if (cardType === "ux_tarefa") {
    // Transition Jira status for UX Tarefas
    const jiraTarget = COLUMN_TO_JIRA_STATUS[targetColumn]
    if (jiraTarget) {
      const result = await transitionIssueToStatus(base, credentials, issueKey, jiraTarget)
      if (!result.ok) return result
    }
    // No DB column state needed for UX Tarefas (derived from Jira status)
    return { ok: true }
  } else {
    // Demandas: update local column state only (no Jira sync except Done)
    await db.kanbanUserCardState.upsert({
      where: { issueKey },
      create: { issueKey, userId, column: targetColumn },
      update: { column: targetColumn },
    })
    return { ok: true }
  }
}

// ─── Per-user kanban: complete a card (Done with Jira comment) ─────────────────

export async function completeCardDone(
  issueKey: string,
  cardType: "ux_tarefa" | "demanda",
  mentionedAccountId: string | null,
  mentionedDisplayName: string | null,
  reporterAccountId: string | null,
  reporterDisplayName: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  const mention =
    mentionedAccountId && mentionedDisplayName
      ? { accountId: mentionedAccountId, displayName: mentionedDisplayName }
      : null

  if (cardType === "ux_tarefa") {
    // UX Tarefa Done → transition to "Delivered" + comment
    const transResult = await transitionIssueToStatus(base, credentials, issueKey, "Delivered")
    if (!transResult.ok) return transResult

    const commentBody = buildAdfComment(
      `Card ${issueKey} entregue. 🎉`,
      mention ?? (reporterAccountId && reporterDisplayName ? { accountId: reporterAccountId, displayName: reporterDisplayName } : undefined),
    )
    await postJiraComment(base, credentials, issueKey, commentBody)
  } else {
    // Demanda Done → transition Jira to "Análise de Produto" + comment
    const transResult = await transitionIssueToStatus(base, credentials, issueKey, "Análise de Produto")
    if (!transResult.ok) {
      // Try fallback transition name
      await transitionIssueToStatus(base, credentials, issueKey, "Produto").catch(() => null)
    }

    const reporter = reporterAccountId && reporterDisplayName
      ? { accountId: reporterAccountId, displayName: reporterDisplayName }
      : null
    const commentBody = buildAdfComment(
      `Protótipo do card ${issueKey} entregue. 🎉`,
      mention ?? reporter ?? undefined,
    )
    await postJiraComment(base, credentials, issueKey, commentBody)

    // Update local column state
    const assignment = await db.kanbanAssignment.findUnique({ where: { issueKey } })
    if (assignment) {
      await db.kanbanUserCardState.upsert({
        where: { issueKey },
        create: { issueKey, userId: assignment.userId, column: "done" },
        update: { column: "done" },
      })
    }
  }

  // Clean up In Approval tracker
  await db.kanbanInApprovalTracker.deleteMany({ where: { issueKey } }).catch(() => null)

  return { ok: true }
}

// ─── @Mention autocomplete ────────────────────────────────────────────────────

export async function searchJiraUsers(
  query: string,
): Promise<{ ok: boolean; users?: { accountId: string; displayName: string; avatarUrl: string | null }[]; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  const users = await searchJiraUsersForMention(base, credentials, query)
  return { ok: true, users }
}

// ─── In Approval automation (internal) ────────────────────────────────────────

async function _enterInApproval(
  base: string,
  credentials: string,
  issueKey: string,
  cardType: "ux_tarefa" | "demanda",
  userId: string,
): Promise<void> {
  const existing = await db.kanbanInApprovalTracker.findUnique({ where: { issueKey } })
  if (!existing) {
    // First time entering In Approval → create tracker + post comment
    await db.kanbanInApprovalTracker.create({
      data: { issueKey, userId, cardType, lastCommentAt: new Date() },
    })

    // Fetch reporter for mention
    const detailsMap = await fetchIssueDetailsByKeys(base, credentials, [issueKey]).catch(() => new Map<string, KanbanIssueDetail>())
    const detail = detailsMap.get(issueKey.toUpperCase())
    const mention = detail?.reporterAccountId && detail.reporterDisplayName
      ? { accountId: detail.reporterAccountId, displayName: detail.reporterDisplayName }
      : undefined

    const body = buildAdfComment(
      `Card ${issueKey} enviado para aprovação.`,
      mention,
    )
    await postJiraComment(base, credentials, issueKey, body).catch(() => null)
  }
}

async function _checkAndSendApprovalReminders(
  base: string,
  credentials: string,
  userId: string,
): Promise<void> {
  const now = new Date()
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const trackers = await db.kanbanInApprovalTracker.findMany({ where: { userId } })

  for (const tracker of trackers) {
    const lastCheck = tracker.lastCommentAt ?? tracker.enteredAt
    if (lastCheck <= cutoff24h) {
      // More than 24h since last comment → send reminder
      const detailsMap = await fetchIssueDetailsByKeys(base, credentials, [tracker.issueKey]).catch(() => new Map<string, KanbanIssueDetail>())
      const detail = detailsMap.get(tracker.issueKey.toUpperCase())
      const mention = detail?.reporterAccountId && detail.reporterDisplayName
        ? { accountId: detail.reporterAccountId, displayName: detail.reporterDisplayName }
        : undefined

      const hoursInApproval = Math.round((now.getTime() - tracker.enteredAt.getTime()) / 3_600_000)
      const body = buildAdfComment(
        `Card ${tracker.issueKey} está em aprovação há ${hoursInApproval}h. Aguardando retorno.`,
        mention,
      )
      await postJiraComment(base, credentials, tracker.issueKey, body).catch(() => null)
      await db.kanbanInApprovalTracker.update({
        where: { issueKey: tracker.issueKey },
        data: { lastCommentAt: now },
      }).catch(() => null)
    }
  }
}
