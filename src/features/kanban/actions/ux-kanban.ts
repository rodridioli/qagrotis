"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { db } from "@/core/db"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  jiraJson,
  buildAdfComment,
  buildAdfCommentInline,
  postJiraComment,
  transitionIssueToStatus,
  searchJiraUsersForMention,
  fetchIssueDetailsByKeys,
  fetchUxTarefasForUser,
  createJiraIssue,
  uploadJiraAttachments,
  resolveTagFieldId,
  resolveTypeFieldId,
  resolveSolicitanteFieldId,
  resolveDeadlineFieldId,
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
  "in approval":   "in_approval",  // fallback: projetos com workflow em inglês
  "aprovação":     "in_approval",  // workflow padrão Jira (português)
  "delivered":     "done",
  "entregue":      "done",     // status "ENTREGUE" no workflow UX (PT-BR)
  "canceled":      "canceled",
  "cancelado":     "canceled",
}

function jiraStatusToColumn(status: string): UserKanbanColumn {
  return UX_TAREFA_STATUS_TO_COLUMN[status.toLowerCase()] ?? "backlog"
}

/** Maps per-user kanban column → Jira transition target name */
const COLUMN_TO_JIRA_STATUS: Record<UserKanbanColumn, string | null> = {
  backlog:      "Pending UX",
  in_progress:  "In Progress",
  paused:       "Paused",
  waiting:      "Waiting",
  in_approval:  "Aprovação",
  done:         "Entregue",
  canceled:     "Cancelado",  // UX project: "CANCELADO"; Demandas handled separately
}

// ─── Business-hours helper ────────────────────────────────────────────────────

/**
 * Conta quantas horas úteis (Seg–Sex, 08:00–18:00 BRT = UTC-3) existem entre
 * dois instantes. Itera hora a hora — número máximo de iterações por ciclo é
 * ~720 (30 dias × 24 h), totalmente aceitável.
 */
function businessHoursBetween(from: Date, to: Date): number {
  const MS_PER_HOUR = 3_600_000
  const BRT_OFFSET_MS = -3 * MS_PER_HOUR // UTC-3 (Brasília)
  let count = 0
  // Começa na próxima hora cheia após `from`
  let t = new Date(Math.ceil(from.getTime() / MS_PER_HOUR) * MS_PER_HOUR)
  while (t <= to) {
    const local = new Date(t.getTime() + BRT_OFFSET_MS)
    const dow = local.getUTCDay()    // 0=Dom, 1=Seg … 5=Sex, 6=Sáb
    const h   = local.getUTCHours() // hora local
    if (dow >= 1 && dow <= 5 && h >= 8 && h < 18) count++
    t = new Date(t.getTime() + MS_PER_HOUR)
  }
  return count
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

  const rows = await db.kanbanAssignment.findMany({ take: 2000 })
  return Object.fromEntries(
    rows.map((r) => [r.issueKey, { userId: r.userId, cardType: (r.cardType as "demanda" | "ux_tarefa") }])
  )
}

// ─── Main kanban: fetch column states for all demanda cards ──────────────────

/**
 * Returns a map of issueKey → UserKanbanColumn for every card that has a
 * persisted KanbanUserCardState row. Used by the main kanban to visually
 * indicate whether a card is in "Feito" (done) or "Cancelado" (canceled) in
 * the assignee's personal kanban.
 */
export async function getMainKanbanColumnStates(): Promise<Record<string, UserKanbanColumn>> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return {}

  const rows = await db.kanbanUserCardState.findMany({ take: 5000 })
  return Object.fromEntries(rows.map((r) => [r.issueKey, r.column as UserKanbanColumn]))
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

  // Step 1: assignments must resolve first — tarefaKeys/demandaKeys derive from it
  const assignments = await db.kanbanAssignment.findMany({ where: { userId } })
  const tarefaKeys = assignments.filter((a) => a.cardType === "ux_tarefa").map((a) => a.issueKey)
  const demandaKeys = assignments.filter((a) => a.cardType === "demanda").map((a) => a.issueKey)

  // Step 2: remaining DB queries are independent — run in parallel
  const [columnStates, jiraCache, profile] = await Promise.all([
    db.kanbanUserCardState.findMany({ where: { userId } }),
    db.jiraAccountIdCache.findUnique({ where: { userId } }).catch(() => null),
    db.userProfile.findUnique({ where: { userId }, select: { name: true } }).catch(() => null),
  ])
  const columnMap = Object.fromEntries(columnStates.map((s) => [s.issueKey, s.column as UserKanbanColumn]))
  const jiraAccountId = jiraCache?.accountId ?? null

  // Step 3: createdUser only needed when profile is absent (sequential by design)
  const createdUser = !profile
    ? await db.createdUser.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null)
    : null
  const memberName = profile?.name ?? createdUser?.name ?? userId

  // Fire-and-forget: approval reminders don't affect returned data — no blocking await
  void _checkAndSendApprovalReminders(base, credentials, userId)

  // Step 4: all three Jira fetches are independent — run in parallel
  const [tarefasFromJira, tarefaDetailsMap, demandaDetailsMap] = await Promise.all([
    jiraAccountId
      ? fetchUxTarefasForUser(base, credentials, jiraAccountId).catch(() => [] as UxTarefa[])
      : Promise.resolve([] as UxTarefa[]),
    fetchIssueDetailsByKeys(base, credentials, tarefaKeys).catch(() => new Map<string, KanbanIssueDetail>()),
    fetchIssueDetailsByKeys(base, credentials, demandaKeys).catch(() => new Map<string, KanbanIssueDetail>()),
  ])

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

  // Jira status values that mean "canceled" for Demandas
  const DEMANDA_CANCELED_STATUSES = new Set(["canceled", "cancel", "cancelado", "cancelled"])

  const demandaCards: UserKanbanCard[] = demandaKeys.flatMap((key) => {
    const detail = demandaDetailsMap.get(key.toUpperCase())
    if (!detail) return []

    // If Jira already shows the issue as canceled, override the local column —
    // someone may have canceled it directly in Jira without going through the kanban.
    const jiraStatusLower = detail.jiraStatus.toLowerCase()
    const canceledByJira = DEMANDA_CANCELED_STATUSES.has(jiraStatusLower)
    const column: UserKanbanColumn = canceledByJira ? "canceled" : (columnMap[key] ?? "backlog")

    // Sync the local DB state in the background when Jira is ahead
    if (canceledByJira && columnMap[key] !== "canceled") {
      void db.kanbanUserCardState.upsert({
        where: { issueKey: key },
        create: { issueKey: key, userId, column: "canceled" },
        update: { column: "canceled" },
      }).catch(() => null)
    }

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
      column,
    }]
  })

  // Filter done/canceled cards that are older than 15 days
  const FIFTEEN_DAYS_AGO = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  const stateUpdatedAtMap = Object.fromEntries(columnStates.map((s) => [s.issueKey, s.updatedAt]))

  const allCards = [...tarefaCards, ...demandaCards].filter((card) => {
    if (card.column !== "done" && card.column !== "canceled") return true
    const updatedAt = stateUpdatedAtMap[card.key]
    if (!updatedAt) return true  // No timestamp record → include (can't filter without it)
    return updatedAt >= FIFTEEN_DAYS_AGO
  })

  return {
    ok: true,
    cards: allCards,
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

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  // Find which user this card belongs to (for tracker)
  const assignment = await db.kanbanAssignment.findUnique({ where: { issueKey } })
  const userId = assignment?.userId ?? ""

  // Server-side guard: Demandas already in "canceled" cannot be moved
  if (cardType === "demanda") {
    const state = await db.kanbanUserCardState.findUnique({ where: { issueKey } })
    if (state?.column === "canceled") {
      return { ok: false, error: "Cards cancelados não podem ser movidos." }
    }
  }

  // Handle In Approval entry/exit tracking
  if (targetColumn === "in_approval") {
    await _enterInApproval(base, credentials, issueKey, cardType, userId)
  } else {
    // Leaving in_approval or never was there — clean up tracker
    await db.kanbanInApprovalTracker.deleteMany({ where: { issueKey } }).catch(() => null)
  }

  if (cardType === "ux_tarefa") {
    // UX Tarefas: transition Jira status
    // "canceled" → "Cancelado" (matches to.name="CANCELADO" in UX workflow)
    // all other columns use COLUMN_TO_JIRA_STATUS
    const jiraTarget = COLUMN_TO_JIRA_STATUS[targetColumn]
    if (jiraTarget) {
      const result = await transitionIssueToStatus(base, credentials, issueKey, jiraTarget)
      if (!result.ok) return result
    }
    // For terminal columns, persist a state row so the 15-day filter in getUserKanbanData works
    if (targetColumn === "done" || targetColumn === "canceled") {
      await db.kanbanUserCardState.upsert({
        where: { issueKey },
        create: { issueKey, userId, column: targetColumn },
        update: { column: targetColumn },
      }).catch(() => null)
    } else {
      // Leaving a terminal state (edge case) — remove stale record
      await db.kanbanUserCardState.deleteMany({ where: { issueKey } }).catch(() => null)
    }
    return { ok: true }
  } else {
    // Demandas: update local column state
    // For "canceled", also sync Jira status to "Cancel" (to.name="CANCEL")
    if (targetColumn === "canceled") {
      await transitionIssueToStatus(base, credentials, issueKey, "Cancel").catch(() => null)
    }
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

  // Resolve mention: prefer explicitly selected user, fallback to reporter
  const effectiveMention =
    mention ??
    (reporterAccountId && reporterDisplayName
      ? { accountId: reporterAccountId, displayName: reporterDisplayName }
      : null)

  if (cardType === "ux_tarefa") {
    // UX Tarefa Done → transition to "Entregue" (Jira status name in the UX workflow)
    const transResult = await transitionIssueToStatus(base, credentials, issueKey, "Entregue")
    if (!transResult.ok) return transResult

    // "Tarefa aprovada por @Name e concluída junto ao time de UX."
    const commentBody = effectiveMention
      ? buildAdfCommentInline(
          "Tarefa aprovada por ",
          effectiveMention,
          " e concluída junto ao time de UX.",
        )
      : buildAdfComment("Tarefa concluída junto ao time de UX.")
    await postJiraComment(base, credentials, issueKey, commentBody)

    // Persist terminal state so the 15-day filter in getUserKanbanData works
    const tarefaAssignment = await db.kanbanAssignment.findUnique({ where: { issueKey } })
    if (tarefaAssignment) {
      await db.kanbanUserCardState.upsert({
        where: { issueKey },
        create: { issueKey, userId: tarefaAssignment.userId, column: "done" },
        update: { column: "done" },
      }).catch(() => null)
    }
  } else {
    // Demanda Done → transition Jira to "Análise de Produto"
    // transitionIssueToStatus matches by to.name (status name), so "Análise de Produto"
    // finds the "Iniciar ideação → ANÁLISE DE PRODUTO" transition correctly.
    const transResult = await transitionIssueToStatus(base, credentials, issueKey, "Análise de Produto")
    if (!transResult.ok) {
      // Fallback: some workflows name the transition differently
      await transitionIssueToStatus(base, credentials, issueKey, "Produto").catch(() => null)
    }

    // "Tarefa aprovada por @Name e concluída junto ao time de UX."
    const commentBody = effectiveMention
      ? buildAdfCommentInline(
          "Tarefa aprovada por ",
          effectiveMention,
          " e concluída junto ao time de UX.",
        )
      : buildAdfComment("Tarefa concluída junto ao time de UX.")
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

// ─── Confirm In Approval (with mandatory approver) ────────────────────────────

/**
 * Chamada pelo modal de "Em aprovação" quando o usuário confirma o aprovador.
 * Faz a transição Jira, cria/atualiza o tracker com o aprovador e posta o
 * comentário padrão mencionando o aprovador selecionado.
 */
export async function confirmInApproval(
  issueKey: string,
  cardType: "ux_tarefa" | "demanda",
  approverAccountId: string,
  approverDisplayName: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  const assignment = await db.kanbanAssignment.findUnique({ where: { issueKey } })
  const userId = assignment?.userId ?? ""

  // Transition Jira status
  if (cardType === "ux_tarefa") {
    const jiraTarget = COLUMN_TO_JIRA_STATUS["in_approval"]
    if (jiraTarget) {
      const result = await transitionIssueToStatus(base, credentials, issueKey, jiraTarget)
      if (!result.ok) return result
    }
  } else {
    // Demanda: persiste estado local
    await db.kanbanUserCardState.upsert({
      where: { issueKey },
      create: { issueKey, userId, column: "in_approval" },
      update: { column: "in_approval" },
    })
  }

  // Cria/atualiza tracker com dados do aprovador
  const now = new Date()
  await db.kanbanInApprovalTracker.upsert({
    where: { issueKey },
    create: {
      issueKey,
      userId,
      cardType,
      approverAccountId,
      approverDisplayName,
      enteredAt: now,
      lastCommentAt: now,
    },
    update: {
      approverAccountId,
      approverDisplayName,
      enteredAt: now,
      lastCommentAt: now,
    },
  })

  // Posta comentário: "@aprovador, a tarefa de UX foi concluída e aguarda a sua aprovação."
  const body = buildAdfComment(
    ", a tarefa de UX foi concluída e aguarda a sua aprovação.",
    { accountId: approverAccountId, displayName: approverDisplayName },
  )
  await postJiraComment(base, credentials, issueKey, body).catch(() => null)

  return { ok: true }
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
      ` Card ${issueKey} enviado para aprovação.`,
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
  const trackers = await db.kanbanInApprovalTracker.findMany({ where: { userId } })

  for (const tracker of trackers) {
    const lastCheck = tracker.lastCommentAt ?? tracker.enteredAt
    // Verifica 24 horas úteis desde o último comentário
    if (businessHoursBetween(lastCheck, now) >= 24) {
      // Usa o aprovador salvo; se não houver (registros antigos), pula a menção
      const mention = tracker.approverAccountId && tracker.approverDisplayName
        ? { accountId: tracker.approverAccountId, displayName: tracker.approverDisplayName }
        : undefined

      const body = buildAdfComment(
        mention
          ? ", a tarefa de UX foi concluída e aguarda a sua aprovação."
          : `Card ${tracker.issueKey} está aguardando aprovação.`,
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

// ─── Text → ADF helper ────────────────────────────────────────────────────────

/**
 * Converts plain text to Atlassian Document Format (ADF) for use in Jira
 * description/comment fields.  Line breaks are represented as hardBreak nodes
 * so they round-trip cleanly through the Jira editor.
 */
function textToAdf(text: string): object {
  const lines = text.split("\n")
  const content: object[] = []
  lines.forEach((line, i) => {
    if (line) content.push({ type: "text", text: line })
    if (i < lines.length - 1) content.push({ type: "hardBreak" })
  })
  return {
    version: 1,
    type: "doc",
    content: [{ type: "paragraph", content: content.length ? content : [] }],
  }
}

// ─── Create UX Tarefa ─────────────────────────────────────────────────────────

/**
 * Creates a new Tarefa in the UX Jira project from FormData submitted by the
 * kanban "+" modal.
 *
 * FormData keys:
 *   summary        – string (required)
 *   tag            – string (optional, Jira select value)
 *   priority       – string (optional, e.g. "High", "Medium")
 *   type           – string (optional, Jira select value)
 *   deadline       – string (optional, "YYYY-MM-DD")
 *   solicitante    – string (optional, plain text)
 *   description    – string (optional, converted to ADF)
 *   attachment_N   – File  (optional, indexed from 0)
 *
 * Returns { ok: true, issueKey } on full success, or
 *         { ok: true, issueKey, error } when the issue was created but an
 *         attachment upload failed (caller shows a warning, not an error).
 */
export async function createUxTarefa(
  formData: FormData,
): Promise<{ ok: boolean; issueKey?: string; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const creds = await resolveCredentials(session.user.id)
  if (!creds) return { ok: false, error: "Credenciais Jira não configuradas." }
  const { base, credentials } = creds

  const summary     = (formData.get("summary")     as string | null)?.trim()
  const tag         = (formData.get("tag")          as string | null)?.trim()
  const priority    = (formData.get("priority")     as string | null)?.trim()
  const type        = (formData.get("type")         as string | null)?.trim()
  const deadline    = (formData.get("deadline")     as string | null)?.trim()
  const solicitante = (formData.get("solicitante")  as string | null)?.trim()
  const description = (formData.get("description")  as string | null)?.trim()

  if (!summary) return { ok: false, error: "O título é obrigatório." }

  // Resolve all custom field IDs in parallel (results are cached after first call)
  const [tagFieldId, typeFieldId, solicitanteFieldId, deadlineFieldId] = await Promise.all([
    resolveTagFieldId(base, credentials),
    resolveTypeFieldId(base, credentials),
    resolveSolicitanteFieldId(base, credentials),
    resolveDeadlineFieldId(base, credentials),
  ])

  // Build the Jira fields payload
  const fields: Record<string, unknown> = {
    project:   { key: "UX" },
    issuetype: { name: "Tarefa" },
    summary,
  }

  if (priority)                          fields.priority            = { name: priority }
  if (description)                       fields.description         = textToAdf(description)
  if (tag         && tagFieldId)         fields[tagFieldId]         = { value: tag }
  if (type        && typeFieldId)        fields[typeFieldId]        = { value: type }
  if (deadline    && deadlineFieldId)    fields[deadlineFieldId]    = deadline
  if (solicitante && solicitanteFieldId) fields[solicitanteFieldId] = solicitante

  // Create the Jira issue
  const createRes = await createJiraIssue(base, credentials, fields)
  if (!createRes.ok || !createRes.key) {
    return { ok: false, error: createRes.error ?? "Erro ao criar tarefa no Jira." }
  }

  // Collect attachment files (indexed as attachment_0, attachment_1, …)
  const files: File[] = []
  for (let i = 0; ; i++) {
    const file = formData.get(`attachment_${i}`)
    if (!file || !(file instanceof File)) break
    files.push(file)
  }

  if (files.length > 0) {
    const uploadRes = await uploadJiraAttachments(base, credentials, createRes.key, files)
    if (!uploadRes.ok) {
      // Issue was created successfully — surface the attachment error as a warning
      return { ok: true, issueKey: createRes.key, error: uploadRes.error }
    }
  }

  return { ok: true, issueKey: createRes.key }
}
