"use server"

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { db } from "@/core/db"

export type KanbanAssignments = Record<string, string> // issueKey → userId

export async function getKanbanAssignments(): Promise<KanbanAssignments> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return {}

  const rows = await db.kanbanAssignment.findMany()
  return Object.fromEntries(rows.map((r) => [r.issueKey, r.userId]))
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
