"use server"

import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  findJiraAccountIdByEmail,
  findJiraAccountIdsByDisplayName,
  findJiraAccountIdFromRecentIssueWorklogs,
  fetchWorklogsForAuthorInRange,
  fetchIssueFieldsForKeys,
  augmentFieldMapWithGetIssueFallback,
  fetchRetornosForKeys,
  fetchApprovalIssuesByTag,
  countReporterIssuesByTypes,
  fetchBrokenTestFieldSumByReporter,
  type ApprovalIssueEntry,
  type JiraLancamentoEntry,
  type RetornosResult,
} from "@/features/qa/lib/jira-worklogs-fetch"
import {
  fetchClockworkWorklogsForEmail,
  mergeJiraAndClockworkWorklogs,
} from "@/features/qa/lib/clockwork-worklogs-fetch"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { resolveEmailForQaUserId, resolveNameForQaUserId } from "@/features/usuarios/actions/usuarios"

export interface UxJiraEntry {
  issueKey: string
  projectName: string | null
  typeField: string | null
  issueType: string | null
  status: string | null
  tag: string | null
  priority: string | null
  retornos: number
  retornosByAssignee: Record<string, number>
  authorJiraAccountId: string | null
  qtdCenariosQA: number
  qtdCenariosErro: number
  started: string
  timeSpentSeconds: number
}

/**
 * Broken Test stats per month, derived from reporter-based JQL (independent of worklogs).
 * Keyed by month index 0–11.
 *
 * jirasBroken    — count of BT issues created by the user as reporter in the month
 * cenariosErroSum — sum of qtdCenariosQA of those BT issues (Tipo B for "Cenários com Erro")
 */
export interface BtMonthStats {
  jirasBroken: number
  cenariosErroSum: number
}

const JIRA_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/i

// ── In-process metadata freshness cache ──────────────────────────────────────

/**
 * TTL for issue metadata re-validation (issueType, priority, qtdCenariosQA, etc.).
 * Module-level map survives across requests in the same Node.js process.
 * If the process restarts, the TTL resets — which triggers a Jira call on the next request.
 */
const METADATA_TTL_MS = 15 * 60 * 1000
const metadataRefreshTimestamps = new Map<string, number>()

// ── Freshness helpers ─────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Returns true when a (year, month) should be re-synced with Jira. */
function needsSync(
  syncedAt: Date | null,
  year: number,
  month: number,
  force = false,
): boolean {
  if (!syncedAt) return true

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Months older than the previous month are immutable — serve from cache forever
  if (year < currentYear) return false
  if (year === currentYear && month < currentMonth - 1) return false

  // Last two months (previous + current): forced sync always re-syncs;
  // otherwise re-sync once per day
  if (force) return true
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
  if (!creds) {
    console.warn("[tw-sync] Credenciais Jira não configuradas para viewerUserId=%s — sync abortado para %s", viewerUserId, targetEmail)
    return
  }

  const { jiraUrl, jiraEmail, apiToken } = creds
  const base = jiraUrl
  const credentials = Buffer.from(`${jiraEmail}:${apiToken}`).toString("base64")

  let jiraUser = await findJiraAccountIdByEmail(base, credentials, targetEmail).catch((err) => {
    console.warn("[tw-sync] Erro ao buscar accountId no Jira para email=%s: %s", targetEmail, err)
    return null
  })
  let accountIdSource: string | null = jiraUser ? "email" : null

  // Fallback 1: email não encontrado (ex.: privacidade de e-mail no Jira Cloud).
  // Tenta casar pelo nome de exibição do usuário — aceita apenas match unívoco.
  if (!jiraUser) {
    const displayName = await resolveNameForQaUserId(targetUserId).catch(() => null)
    if (displayName) {
      const candidates = await findJiraAccountIdsByDisplayName(base, credentials, displayName).catch(() => [])
      if (candidates.length === 1) {
        jiraUser = { accountId: candidates[0]!.accountId, displayName: candidates[0]!.displayName }
        accountIdSource = "displayName"
        console.info("[tw-sync] accountId resolvido via displayName para userId=%s name=%s → %s", targetUserId, displayName, jiraUser.accountId)
      } else if (candidates.length > 1) {
        console.warn("[tw-sync] displayName ambíguo (%d matches) para userId=%s name=%s", candidates.length, targetUserId, displayName)
      }
    }
  }

  // Fallback 2: accountId previamente armazenado no cache persistente (JiraAccountIdCache).
  // Sobrevive ao force-sync (que apaga apenas JiraWorklogCache) e permite sincronizar
  // ex-membros desativados no Jira cujo accountId foi resolvido durante período ativo.
  if (!jiraUser) {
    const cached = await prisma.jiraAccountIdCache.findUnique({
      where: { userId: targetUserId },
      select: { accountId: true },
    }).catch(() => null)
    if (cached?.accountId) {
      jiraUser = { accountId: cached.accountId }
      accountIdSource = "db-account-cache"
      console.info("[tw-sync] accountId recuperado de JiraAccountIdCache para userId=%s → %s", targetUserId, jiraUser.accountId)
    }
  }

  // Fallback 3: busca em qualquer entrada antiga do JiraWorklogCache (outros anos/meses).
  // Útil quando JiraAccountIdCache ainda não foi populado para este usuário.
  if (!jiraUser) {
    const fromWorklog = await prisma.jiraWorklogCache.findFirst({
      where: { userId: targetUserId, authorJiraAccountId: { not: null } },
      select: { authorJiraAccountId: true },
      orderBy: { startedAt: "desc" },
    }).catch(() => null)
    if (fromWorklog?.authorJiraAccountId) {
      jiraUser = { accountId: fromWorklog.authorJiraAccountId }
      accountIdSource = "db-worklog-cache"
      console.info("[tw-sync] accountId recuperado de JiraWorklogCache (histórico) para userId=%s → %s", targetUserId, jiraUser.accountId)
    }
  }

  // Fallback 4: extrai accountId diretamente dos worklogs de issues onde o usuário
  // é reporter/assignee. Funciona mesmo para contas Jira completamente desativadas —
  // o endpoint de worklog sempre retorna author.accountId independente do status da conta.
  if (!jiraUser) {
    const displayName = await resolveNameForQaUserId(targetUserId).catch(() => null)
    const extracted = await findJiraAccountIdFromRecentIssueWorklogs(base, credentials, targetEmail, displayName).catch(() => null)
    if (extracted) {
      jiraUser = { accountId: extracted }
      accountIdSource = "worklog-extract"
      console.info("[tw-sync] accountId extraído de worklogs de issues para userId=%s email=%s → %s", targetUserId, targetEmail, extracted)
    }
  }

  // Quando o accountId foi resolvido com sucesso, persistir no cache dedicado para uso futuro.
  if (jiraUser && accountIdSource) {
    await prisma.jiraAccountIdCache.upsert({
      where: { userId: targetUserId },
      update: { accountId: jiraUser.accountId, resolvedBy: accountIdSource },
      create: { userId: targetUserId, accountId: jiraUser.accountId, resolvedBy: accountIdSource },
    }).catch(() => undefined) // não abortar sync por falha no cache
  }

  const clockworkOnlyMode = !jiraUser
  if (clockworkOnlyMode) {
    console.info(
      "[tw-sync] userId=%s email=%s não encontrado no Jira (mesmo com includeInactive) — modo clockwork-only para year=%d months=%s",
      targetUserId, targetEmail, year, months.join(","),
    )
  }

  // Group consecutive months into ranges (each ≤ 92 days, 3 months = ~92 days max)
  // Process month by month to keep ranges well within the 92-day limit.
  for (const month of months) {
    const fromIso = `${year}-${pad(month + 1)}-01`
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0).getDate()
    const toIso = `${year}-${pad(month + 1)}-${pad(lastDay)}`

    // Skip Jira worklog fetch when we have no accountId (inactive/not-found user)
    const jiraEntries: JiraLancamentoEntry[] = clockworkOnlyMode
      ? []
      : await fetchWorklogsForAuthorInRange(
          base, credentials, jiraUser!.accountId, fromIso, toIso, "UTC",
        ).then((r) => r.entries).catch(() => [])

    let clockworkEntries: JiraLancamentoEntry[] = []
    try {
      const clockworkToken = (await getClockworkApiTokenResolved()).trim()
      if (clockworkToken) {
        clockworkEntries = await fetchClockworkWorklogsForEmail({
          token: clockworkToken,
          emailNorm: targetEmail.trim().toLowerCase(),
          fromIso,
          toIso,
          timeZoneId: "UTC",
        })
      }
    } catch {
      // Clockwork is optional — failure does not abort the Jira sync
    }

    // In clockwork-only mode, skip if Clockwork also returned nothing (avoid empty marker)
    if (clockworkOnlyMode && clockworkEntries.length === 0) {
      console.info("[tw-sync] clockwork-only: sem entradas para userId=%s month=%d/%d — marker não gravado", targetUserId, month + 1, year)
      continue
    }

    const { merged: rawEntries } = mergeJiraAndClockworkWorklogs(jiraEntries, clockworkEntries)

    let entries = rawEntries
    const validKeys = Array.from(
      new Set(rawEntries.map((e) => e.issueKey.trim().toUpperCase()).filter((k) => JIRA_KEY_RE.test(k))),
    )

    if (validKeys.length > 0) {
      const fieldMap = await fetchIssueFieldsForKeys(base, credentials, validKeys).catch(
        () => new Map<string, import("@/features/qa/lib/jira-worklogs-fetch").LancamentoIssueFieldsPatch>(),
      )
      await augmentFieldMapWithGetIssueFallback(base, credentials, fieldMap, validKeys).catch(() => undefined)
      const retornosMap = await fetchRetornosForKeys(base, credentials, validKeys).catch(
        () => new Map<string, RetornosResult>(),
      )
      entries = rawEntries.map((e) => {
        const key = e.issueKey.trim().toUpperCase()
        const patch = fieldMap.get(key)
        const retornosData = retornosMap.get(key)
        return {
          ...e,
          typeField: patch?.typeField?.trim() ? patch.typeField.trim() : e.typeField,
          issueType: patch?.issueType?.trim() ? patch.issueType.trim() : (e as { issueType?: string | null }).issueType ?? null,
          projectName: patch?.projectName?.trim() ? patch.projectName.trim() : e.projectName,
          priority: patch?.priority?.trim() ? patch.priority.trim() : (e.priority ?? null),
          status: patch?.status?.trim() ? patch.status.trim() : (e.status ?? null),
          tag: patch?.tag?.trim() ? patch.tag.trim() : null,
          retornos: retornosData?.total ?? 0,
          retornosByAssignee: retornosData?.byAssignee ?? {},
          // authorJiraAccountId is null in clockwork-only mode (no Jira accountId available)
          authorJiraAccountId: jiraUser?.accountId ?? null,
          qtdCenariosQA: patch?.qtdCenariosQA ?? 0,
          qtdCenariosErro: patch?.qtdCenariosErro ?? 0,
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
            issueType: (e as { issueType?: string | null }).issueType ?? null,
            status: e.status ?? null,
            tag: (e as { tag?: string | null }).tag ?? null,
            priority: (e as { priority?: string | null }).priority ?? null,
            retornos: (e as { retornos?: number }).retornos ?? 0,
            retornosByAssignee: (e as { retornosByAssignee?: Record<string, number> }).retornosByAssignee ?? {},
            authorJiraAccountId: (e as { authorJiraAccountId?: string | null }).authorJiraAccountId ?? null,
            qtdCenariosQA: (e as { qtdCenariosQA?: number }).qtdCenariosQA ?? 0,
            qtdCenariosErro: (e as { qtdCenariosErro?: number }).qtdCenariosErro ?? 0,
            timeSpentSeconds: e.timeSpentSeconds,
            year,
            month,
          },
          create: {
            userId: targetUserId,
            issueKey: e.issueKey.trim().toUpperCase(),
            projectName: e.projectName ?? null,
            typeField: e.typeField ?? null,
            issueType: (e as { issueType?: string | null }).issueType ?? null,
            status: e.status ?? null,
            tag: (e as { tag?: string | null }).tag ?? null,
            priority: (e as { priority?: string | null }).priority ?? null,
            retornos: (e as { retornos?: number }).retornos ?? 0,
            retornosByAssignee: (e as { retornosByAssignee?: Record<string, number> }).retornosByAssignee ?? {},
            authorJiraAccountId: (e as { authorJiraAccountId?: string | null }).authorJiraAccountId ?? null,
            qtdCenariosQA: (e as { qtdCenariosQA?: number }).qtdCenariosQA ?? 0,
            qtdCenariosErro: (e as { qtdCenariosErro?: number }).qtdCenariosErro ?? 0,
            startedAt,
            timeSpentSeconds: e.timeSpentSeconds,
            year,
            month,
          },
        })
      }),
    )

    // Broken Test reporter stats — independent of worklogs.
    // Matches the logic in /api/jira/lancamentos (countReporterIssuesByTypes +
    // fetchBrokenTestFieldSumByReporter) so Dashboard and Lançamentos stay in parity.
    let jirasBroken = 0
    let cenariosErroSum = 0
    if (jiraUser?.accountId) {
      const displayName = await resolveNameForQaUserId(targetUserId).catch(() => null)
      const [btCount, btFields] = await Promise.all([
        countReporterIssuesByTypes(
          base, credentials, jiraUser.accountId, fromIso, toIso, displayName ?? undefined,
        ).catch(() => ({ count: 0 })),
        fetchBrokenTestFieldSumByReporter(
          base, credentials, jiraUser.accountId, fromIso, toIso, displayName ?? undefined,
        ).catch(() => ({ cenariosQASum: 0, issueCount: 0 })),
      ])
      jirasBroken = btCount.count
      cenariosErroSum = btFields.cenariosQASum
    }

    // Mark this month as synced (with BT reporter stats)
    await prisma.jiraWorklogSyncMarker.upsert({
      where: { userId_year_month: { userId: targetUserId, year, month } },
      update: { syncedAt: new Date(), jirasBroken, cenariosErroSum },
      create: { userId: targetUserId, year, month, syncedAt: new Date(), jirasBroken, cenariosErroSum },
    })
  }
}

// ── Metadata refresh ─────────────────────────────────────────────────────────

/**
 * Re-fetches Jira issue metadata (issueType, priority, qtdCenariosQA, qtdCenariosErro,
 * tag, projectName, typeField, status, retornos) for ALL issues cached for a given
 * user+year, updating the cache rows in place.
 *
 * **Why this exists:** The worklog sync (`syncMonthsForUser`) is treated as immutable
 * for months older than the previous month. However, issue metadata can change in Jira
 * after the initial sync (e.g. issueType changes from "Bug" to "Broken Test", or
 * qtdCenariosQA is updated). Without this refresh, the Dashboard shows stale counts
 * while the Lançamentos screen (live API) shows correct ones.
 *
 * Uses a 15-minute in-process TTL per (userId, year) to avoid hammering Jira on every
 * dashboard mount. The TTL resets on process restart.
 */
async function refreshIssueMetadataForUserYear(
  targetUserId: string,
  year: number,
  viewerUserId: string,
): Promise<void> {
  const cacheKey = `${targetUserId}:${year}`
  const lastRefresh = metadataRefreshTimestamps.get(cacheKey) ?? 0
  if (Date.now() - lastRefresh < METADATA_TTL_MS) return

  // Collect all unique issue keys in cache for this user+year
  const rows = await prisma.jiraWorklogCache.findMany({
    where: { userId: targetUserId, year },
    select: { issueKey: true },
    distinct: ["issueKey"],
  })
  if (rows.length === 0) {
    metadataRefreshTimestamps.set(cacheKey, Date.now())
    return
  }
  const issueKeys = (rows as { issueKey: string }[]).map((r) => r.issueKey)

  const creds = await resolveJiraCredentialsForRequest(viewerUserId)
  if (!creds) {
    console.warn(
      "[metadata-refresh] Credenciais Jira não configuradas para viewerUserId=%s — refresh abortado para userId=%s year=%d",
      viewerUserId,
      targetUserId,
      year,
    )
    return
  }

  const { jiraUrl, jiraEmail, apiToken } = creds
  const base = jiraUrl
  const credentials = Buffer.from(`${jiraEmail}:${apiToken}`).toString("base64")

  const fieldMap = await fetchIssueFieldsForKeys(base, credentials, issueKeys).catch(
    () => new Map<string, import("@/features/qa/lib/jira-worklogs-fetch").LancamentoIssueFieldsPatch>(),
  )
  await augmentFieldMapWithGetIssueFallback(base, credentials, fieldMap, issueKeys).catch(() => undefined)
  const retornosMap = await fetchRetornosForKeys(base, credentials, issueKeys).catch(
    () => new Map<string, RetornosResult>(),
  )

  // Update all cache rows for each issue with the fresh metadata fields
  if (fieldMap.size > 0 || retornosMap.size > 0) {
    await Promise.all(
      issueKeys.map(async (rawKey) => {
        const key = rawKey.trim().toUpperCase()
        const patch = fieldMap.get(key)
        const retornosData = retornosMap.get(key)
        if (!patch && !retornosData) return

        const updateData: Record<string, unknown> = {}
        if (patch) {
          // Only overwrite fields that Jira returned non-null values for
          if (patch.issueType != null)   updateData.issueType   = patch.issueType.trim()   || null
          if (patch.typeField != null)   updateData.typeField   = patch.typeField.trim()   || null
          if (patch.projectName != null) updateData.projectName = patch.projectName.trim() || null
          if (patch.priority != null)    updateData.priority    = patch.priority.trim()    || null
          if (patch.status != null)      updateData.status      = patch.status.trim()      || null
          // tag is explicitly nullable in the schema — store null if Jira returns empty
          if ("tag" in patch)            updateData.tag         = patch.tag?.trim()        || null
          if (patch.qtdCenariosQA != null)  updateData.qtdCenariosQA  = patch.qtdCenariosQA
          if (patch.qtdCenariosErro != null) updateData.qtdCenariosErro = patch.qtdCenariosErro
        }
        if (retornosData) {
          updateData.retornos           = retornosData.total     ?? 0
          updateData.retornosByAssignee = retornosData.byAssignee ?? {}
        }
        if (Object.keys(updateData).length === 0) return

        await prisma.jiraWorklogCache
          .updateMany({ where: { userId: targetUserId, year, issueKey: key }, data: updateData })
          .catch((err) => {
            console.warn(
              "[metadata-refresh] Falha ao atualizar metadata issueKey=%s userId=%s: %s",
              key,
              targetUserId,
              err,
            )
          })
      }),
    )
  }

  // Refresh BT reporter stats per sync marker month — these are independent of
  // issue metadata but share the same 15-min TTL to avoid extra Jira requests.
  const jiraAccountCached = await prisma.jiraAccountIdCache.findUnique({
    where: { userId: targetUserId },
    select: { accountId: true },
  }).catch(() => null)
  const btAccountId = jiraAccountCached?.accountId ?? null

  if (btAccountId) {
    const syncMarkers = await prisma.jiraWorklogSyncMarker.findMany({
      where: { userId: targetUserId, year },
      select: { month: true },
    }).catch(() => [] as { month: number }[])

    const displayName = await resolveNameForQaUserId(targetUserId).catch(() => null)

    await Promise.all(
      syncMarkers.map(async ({ month }) => {
        const fromIso = `${year}-${pad(month + 1)}-01`
        const lastDay = new Date(year, month + 1, 0).getDate()
        const toIso = `${year}-${pad(month + 1)}-${pad(lastDay)}`
        const [btCount, btFields] = await Promise.all([
          countReporterIssuesByTypes(
            base, credentials, btAccountId, fromIso, toIso, displayName ?? undefined,
          ).catch(() => ({ count: 0 })),
          fetchBrokenTestFieldSumByReporter(
            base, credentials, btAccountId, fromIso, toIso, displayName ?? undefined,
          ).catch(() => ({ cenariosQASum: 0, issueCount: 0 })),
        ])
        await prisma.jiraWorklogSyncMarker.update({
          where: { userId_year_month: { userId: targetUserId, year, month } },
          data: { jirasBroken: btCount.count, cenariosErroSum: btFields.cenariosQASum },
        }).catch(() => undefined) // non-fatal
      }),
    )
    console.info(
      "[metadata-refresh] BT stats atualizados para userId=%s year=%d (%d meses)",
      targetUserId,
      year,
      syncMarkers.length,
    )
  }

  metadataRefreshTimestamps.set(cacheKey, Date.now())
  console.info(
    "[metadata-refresh] Metadados atualizados para userId=%s year=%d (%d issues)",
    targetUserId,
    year,
    issueKeys.length,
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns cached Jira worklogs for a user/year, syncing stale months as needed.
 * Only Administrador:MGR (or the user themselves) may call this action.
 */
export async function getUxWorklogsForYear(
  targetUserId: string,
  year: number,
  force = false,
): Promise<{ entries: UxJiraEntry[]; btStatsByMonth: Record<number, BtMonthStats> }> {
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

  // When forcing, wipe the entire year cache so all months are re-fetched from Jira
  if (force) {
    await prisma.jiraWorklogCache.deleteMany({ where: { userId: targetUserId, year } })
    await prisma.jiraWorklogSyncMarker.deleteMany({ where: { userId: targetUserId, year } })
  }

  // Load sync markers for all relevant months in one query
  const markers = force
    ? []
    : await prisma.jiraWorklogSyncMarker.findMany({
        where: { userId: targetUserId, year, month: { in: relevantMonths } },
        select: { month: true, syncedAt: true },
      })
  const markerMap = new Map(
    (markers as { month: number; syncedAt: Date }[]).map((mk) => [mk.month, mk.syncedAt]),
  )

  // Determine which months need a Jira sync
  const monthsToSync = force
    ? relevantMonths
    : relevantMonths.filter((m) =>
        needsSync((markerMap.get(m) as Date | undefined) ?? null, year, m, false),
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
        console.error("[tw-sync] Falha no sync userId=%s year=%d: %s", targetUserId, year, err)
      })
    } else {
      console.warn("[tw-sync] userId=%s não tem e-mail cadastrado — sync impossível para year=%d months=%s", targetUserId, year, monthsToSync.join(","))
    }
  }

  // Re-validate issue metadata (issueType, priority, qtdCenariosQA, etc.).
  // These fields can change in Jira after the initial worklog sync, but past months
  // are never re-synced. This ensures Dashboard KPIs match the Lançamentos screen.
  await refreshIssueMetadataForUserYear(targetUserId, year, session.user.id).catch((err) => {
    console.warn(
      "[metadata-refresh] Falha ao atualizar metadados userId=%s year=%d: %s",
      targetUserId,
      year,
      err,
    )
  })

  // Return all cached entries for the year
  const [cached, btMarkers] = await Promise.all([
    prisma.jiraWorklogCache.findMany({
      where: { userId: targetUserId, year },
      select: {
        issueKey: true,
        projectName: true,
        typeField: true,
        issueType: true,
        status: true,
        tag: true,
        priority: true,
        retornos: true,
        retornosByAssignee: true,
        authorJiraAccountId: true,
        qtdCenariosQA: true,
        qtdCenariosErro: true,
        startedAt: true,
        timeSpentSeconds: true,
      },
      orderBy: { startedAt: "asc" },
    }),
    // Fetch BT reporter stats from sync markers — these are the authoritative
    // values for jirasBroken and cenariosErro (Tipo B) in the QA Dashboard.
    prisma.jiraWorklogSyncMarker.findMany({
      where: { userId: targetUserId, year },
      select: { month: true, jirasBroken: true, cenariosErroSum: true },
    }),
  ])

  const btStatsByMonth: Record<number, BtMonthStats> = {}
  for (const mk of btMarkers as { month: number; jirasBroken: number; cenariosErroSum: number }[]) {
    btStatsByMonth[mk.month] = { jirasBroken: mk.jirasBroken, cenariosErroSum: mk.cenariosErroSum }
  }

  return {
    entries: (
      cached as {
        issueKey: string
        projectName: string | null
        typeField: string | null
        issueType: string | null
        status: string | null
        tag: string | null
        priority: string | null
        retornos: number
        retornosByAssignee: unknown
        authorJiraAccountId: string | null
        qtdCenariosQA: number
        qtdCenariosErro: number
        startedAt: Date
        timeSpentSeconds: number
      }[]
    ).map((r) => ({
      issueKey: r.issueKey,
      projectName: r.projectName,
      typeField: r.typeField,
      issueType: r.issueType,
      status: r.status,
      tag: r.tag,
      priority: r.priority,
      retornos: r.retornos,
      retornosByAssignee:
        r.retornosByAssignee && typeof r.retornosByAssignee === "object" && !Array.isArray(r.retornosByAssignee)
          ? (r.retornosByAssignee as Record<string, number>)
          : {},
      authorJiraAccountId: r.authorJiraAccountId,
      qtdCenariosQA: r.qtdCenariosQA,
      qtdCenariosErro: r.qtdCenariosErro,
      started: r.startedAt.toISOString().slice(0, 10),
      timeSpentSeconds: r.timeSpentSeconds,
    })),
    btStatsByMonth,
  }
}

// ── Approval issues by tag (live query — always current) ─────────────────────

const APPROVAL_JQL_PROJECT: Record<"UX" | "TW", string> = {
  UX: "UX",
  TW: "Documentação Técnica",
}

/**
 * Fetches issues in Approval status for the given dashboard profile.
 * UX  → project in ("UX")
 * TW  → project in ("Documentação Técnica")
 */
export async function getApprovalIssuesByTag(
  profile: "UX" | "TW",
): Promise<ApprovalIssueEntry[]> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (role !== "Administrador:MGR") return []

  try {
    const creds = await resolveJiraCredentialsForRequest(session.user.id, session.user.email ?? "")
    if (!creds) return []
    const base = creds.jiraUrl
    const credentials = Buffer.from(`${creds.jiraEmail}:${creds.apiToken}`).toString("base64")
    return await fetchApprovalIssuesByTag(base, credentials, APPROVAL_JQL_PROJECT[profile])
  } catch {
    return []
  }
}

/** @deprecated Use getApprovalIssuesByTag("UX") instead. */
export async function getUxApprovalIssuesByTag(): Promise<ApprovalIssueEntry[]> {
  return getApprovalIssuesByTag("UX")
}

/**
 * Resolves the Jira accountId for each userId via email lookup.
 * Used to filter approval issues by member even when a member has no worklogs
 * (e.g. a Responsável who doesn't log time but is assigned to issues).
 */
export async function getUxMemberJiraIds(
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (role !== "Administrador:MGR") return {}

  try {
    const creds = await resolveJiraCredentialsForRequest(session.user.id, session.user.email ?? "")
    if (!creds) return {}
    const base = creds.jiraUrl
    const credentials = Buffer.from(`${creds.jiraEmail}:${creds.apiToken}`).toString("base64")

    const result: Record<string, string> = {}
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const email = await resolveEmailForQaUserId(userId)
          if (!email) return
          const jiraUser = await findJiraAccountIdByEmail(base, credentials, email)
          if (jiraUser) result[userId] = jiraUser.accountId
        } catch {}
      }),
    )
    return result
  } catch {
    return {}
  }
}

// ── Admin: gerenciamento manual de accountIds Jira ────────────────────────────

/**
 * Retorna todos os registros de JiraAccountIdCache para o painel admin.
 * Inclui o email do usuário para facilitar identificação.
 */
export async function adminListJiraAccountIds(): Promise<
  { userId: string; email: string | null; name: string | null; accountId: string; resolvedBy: string | null; resolvedAt: Date }[]
> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (role !== "Administrador:MGR") throw new Error("Forbidden")

  const rows = await prisma.jiraAccountIdCache.findMany({ orderBy: { resolvedAt: "desc" } })
  return Promise.all(
    rows.map(async (r) => {
      const [email, name] = await Promise.all([
        resolveEmailForQaUserId(r.userId).catch(() => null),
        resolveNameForQaUserId(r.userId).catch(() => null),
      ])
      return { ...r, email, name }
    }),
  )
}

/**
 * Registra ou atualiza manualmente o accountId Jira de um usuário (por email).
 * Permite sincronizar ex-membros cujo accountId não pode ser resolvido automaticamente.
 */
export async function adminSetJiraAccountId(
  email: string,
  jiraAccountId: string,
): Promise<{ ok: true; userId: string; name: string | null } | { ok: false; error: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (role !== "Administrador:MGR") throw new Error("Forbidden")

  const emailNorm = email.trim().toLowerCase()
  const accountIdNorm = jiraAccountId.trim()
  if (!emailNorm || !accountIdNorm) return { ok: false, error: "Email e accountId são obrigatórios." }

  // Resolve userId a partir do email
  const created = await prisma.createdUser.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (!created) return { ok: false, error: `Nenhum usuário encontrado com email "${emailNorm}".` }

  await prisma.jiraAccountIdCache.upsert({
    where: { userId: created.id },
    update: { accountId: accountIdNorm, resolvedBy: "admin" },
    create: { userId: created.id, accountId: accountIdNorm, resolvedBy: "admin" },
  })

  console.info("[admin] JiraAccountIdCache atualizado manualmente: userId=%s email=%s accountId=%s", created.id, emailNorm, accountIdNorm)
  return { ok: true, userId: created.id, name: created.name }
}
