"use server"

import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  findJiraAccountIdByEmail,
  fetchWorklogsForAuthorInRange,
  fetchIssueFieldsForKeys,
  augmentFieldMapWithGetIssueFallback,
  type JiraLancamentoEntry,
} from "@/features/qa/lib/jira-worklogs-fetch"
import { resolveEmailForQaUserId } from "@/features/usuarios/actions/usuarios"

export interface UxJiraEntry {
  issueKey: string
  projectName: string | null
  typeField: string | null
  status: string | null
  started: string
  timeSpentSeconds: number
}

const JIRA_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/i

// ── Freshness helpers ─────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Returns true when a (year, month) should be re-synced with Jira. */
function needsSync(
  syncedAt: Date | null,
  year: number,
  month: number,
): boolean {
  if (!syncedAt) return true

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Any month before the current month is immutable — serve from cache forever
  if (year < currentYear) return false
  if (year === currentYear && month < currentMonth) return false

  // Current month: re-sync once per day
  const elapsed = Date.now() - syncedAt.getTime()
  return elapsed > 24 * 60 * 60 * 1000
}

// ── Sync logic ────────────────────────────────────────────────────────────────

/** Syncs specific months for a user by fetching from Jira and upserting into cache. */
async function syncMonthsForUser(
  targetUserId: string,
  targetEmail: string,
  year: number,
  months: number[],
  viewerUserId: string,
): Promise<void> {
  const creds = await resolveJiraCredentialsForRequest(viewerUserId)
  if (!creds) return

  const { jiraUrl, jiraEmail, apiToken } = creds
  const base = jiraUrl
  const credentials = Buffer.from(`${jiraEmail}:${apiToken}`).toString("base64")

  const jiraUser = await findJiraAccountIdByEmail(base, credentials, targetEmail).catch(() => null)
  if (!jiraUser) return

  // Group consecutive months into ranges (each ≤ 92 days, 3 months = ~92 days max)
  // Process month by month to keep ranges well within the 92-day limit.
  for (const month of months) {
    const fromIso = `${year}-${pad(month + 1)}-01`
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0).getDate()
    const toIso = `${year}-${pad(month + 1)}-${pad(lastDay)}`

    const { entries: rawEntries } = await fetchWorklogsForAuthorInRange(
      base, credentials, jiraUser.accountId, fromIso, toIso, "UTC",
    ).catch(() => ({ entries: [] as JiraLancamentoEntry[], truncatedIssues: false, truncatedWorklogs: false }))

    let entries = rawEntries
    const validKeys = Array.from(
      new Set(rawEntries.map((e) => e.issueKey.trim().toUpperCase()).filter((k) => JIRA_KEY_RE.test(k))),
    )

    if (validKeys.length > 0) {
      const fieldMap = await fetchIssueFieldsForKeys(base, credentials, validKeys).catch(
        () => new Map<string, import("@/features/qa/lib/jira-worklogs-fetch").LancamentoIssueFieldsPatch>(),
      )
      await augmentFieldMapWithGetIssueFallback(base, credentials, fieldMap, validKeys).catch(() => undefined)
      entries = rawEntries.map((e) => {
        const patch = fieldMap.get(e.issueKey.trim().toUpperCase())
        if (!patch) return e
        return {
          ...e,
          typeField: patch.typeField?.trim() ? patch.typeField.trim() : e.typeField,
          projectName: patch.projectName?.trim() ? patch.projectName.trim() : e.projectName,
        }
      })
    }

    // Upsert entries into cache
    await Promise.all(
      entries.map((e) => {
        const startedAt = new Date(e.started)
        if (isNaN(startedAt.getTime())) return Promise.resolve()
        return prisma.jiraWorklogCache.upsert({
          where: {
            userId_issueKey_startedAt: {
              userId: targetUserId,
              issueKey: e.issueKey.trim().toUpperCase(),
              startedAt,
            },
          },
          update: {
            projectName: e.projectName ?? null,
            typeField: e.typeField ?? null,
            status: e.status ?? null,
            timeSpentSeconds: e.timeSpentSeconds,
            year,
            month,
          },
          create: {
            userId: targetUserId,
            issueKey: e.issueKey.trim().toUpperCase(),
            projectName: e.projectName ?? null,
            typeField: e.typeField ?? null,
            status: e.status ?? null,
            startedAt,
            timeSpentSeconds: e.timeSpentSeconds,
            year,
            month,
          },
        })
      }),
    )

    // Mark this month as synced
    await prisma.jiraWorklogSyncMarker.upsert({
      where: { userId_year_month: { userId: targetUserId, year, month } },
      update: { syncedAt: new Date() },
      create: { userId: targetUserId, year, month, syncedAt: new Date() },
    })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns cached Jira worklogs for a user/year, syncing stale months as needed.
 * Only Administrador:MGR (or the user themselves) may call this action.
 */
export async function getUxWorklogsForYear(
  targetUserId: string,
  year: number,
): Promise<{ entries: UxJiraEntry[] }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)

  if (
    targetUserId !== session.user.id &&
    !can(role, "individual.viewOthers")
  ) {
    throw new Error("Forbidden")
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  if (!Number.isInteger(year) || year < currentYear - 1 || year > currentYear) {
    throw new Error("Ano inválido. Apenas o ano atual e o anterior são suportados.")
  }

  // Determine which months of the year are relevant (not in the future)
  const relevantMonths: number[] = []
  for (let m = 0; m <= 11; m++) {
    if (year > currentYear) break
    if (year === currentYear && m > currentMonth) break
    relevantMonths.push(m)
  }

  // Load sync markers for all relevant months in one query
  const markers = await prisma.jiraWorklogSyncMarker.findMany({
    where: { userId: targetUserId, year, month: { in: relevantMonths } },
    select: { month: true, syncedAt: true },
  })
  const markerMap = new Map(
    (markers as { month: number; syncedAt: Date }[]).map((mk) => [mk.month, mk.syncedAt]),
  )

  // Determine which months need a Jira sync
  const monthsToSync = relevantMonths.filter((m) =>
    needsSync((markerMap.get(m) as Date | undefined) ?? null, year, m),
  )

  if (monthsToSync.length > 0) {
    const targetEmail = await resolveEmailForQaUserId(targetUserId)
    if (targetEmail) {
      await syncMonthsForUser(
        targetUserId,
        targetEmail,
        year,
        monthsToSync,
        session.user.id,
      ).catch((err) => {
        console.error("[jira-worklog-cache] sync failed:", err)
      })
    }
  }

  // Return all cached entries for the year
  const cached = await prisma.jiraWorklogCache.findMany({
    where: { userId: targetUserId, year },
    select: {
      issueKey: true,
      projectName: true,
      typeField: true,
      status: true,
      startedAt: true,
      timeSpentSeconds: true,
    },
    orderBy: { startedAt: "asc" },
  })

  return {
    entries: (
      cached as {
        issueKey: string
        projectName: string | null
        typeField: string | null
        status: string | null
        startedAt: Date
        timeSpentSeconds: number
      }[]
    ).map((r) => ({
      issueKey: r.issueKey,
      projectName: r.projectName,
      typeField: r.typeField,
      status: r.status,
      started: r.startedAt.toISOString().slice(0, 10),
      timeSpentSeconds: r.timeSpentSeconds,
    })),
  }
}
