import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can, manageableProfiles } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  fetchClockworkWorklogsForEmail,
  mergeJiraAndClockworkWorklogs,
} from "@/features/qa/lib/clockwork-worklogs-fetch"
import {
  augmentFieldMapWithGetIssueFallback,
  brokenTestSubtasksCountsInParents,
  countReporterIssuesByTypes,
  fetchIssueFieldsForKeys,
  fetchWorklogsForAuthorInRange,
  findJiraAccountIdByEmail,
  resolveTimeZoneForWorklogs,
  type BrokenTestSubtaskCounts,
  type JiraLancamentoEntry,
  type LancamentoIssueFieldsPatch,
  type ReporterCountDiagnostics,
} from "@/features/qa/lib/jira-worklogs-fetch"
import { getActiveQaUsers, resolveEmailForQaUserId, resolveNameForQaUserId } from "@/features/usuarios/actions/usuarios"
import type { NextRequest } from "next/server"

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_RANGE_DAYS = 92

const JIRA_KEY_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/i

function parseIsoDay(s: string | null): string | null {
  if (!s?.trim()) return null
  const t = s.trim()
  if (!ISO_DAY.test(t)) return null
  return t
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime()
  const b = new Date(`${to}T00:00:00.000Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1
}

function normalizeEmailForClockwork(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Mescla um entry com o patch vindo do enrichment (busca direta por key).
 * O patch tem precedência — vem de uma query `key in (…)` que é mais confiável
 * do que o campo retornado pela query de worklog JQL.
 */
function mergeEntryWithPatch(
  e: JiraLancamentoEntry,
  patch: LancamentoIssueFieldsPatch,
): JiraLancamentoEntry {
  return {
    ...e,
    summary: patch.summary?.trim() ? patch.summary : e.summary?.trim() ? e.summary : null,
    issueType: patch.issueType?.trim() ? patch.issueType : e.issueType?.trim() ? e.issueType : null,
    priority: patch.priority?.trim() ? patch.priority : e.priority?.trim() ? e.priority : null,
    labels: patch.labels.length ? patch.labels : e.labels?.length ? e.labels : [],
    qtdCenariosQA:
      patch.qtdCenariosQA != null && Number.isFinite(patch.qtdCenariosQA)
        ? patch.qtdCenariosQA
        : e.qtdCenariosQA != null && Number.isFinite(e.qtdCenariosQA)
          ? e.qtdCenariosQA
          : null,
    projectName: patch.projectName?.trim() ? patch.projectName : e.projectName?.trim() ? e.projectName : null,
  }
}

export async function GET(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "equipe.lancamentos")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const from = parseIsoDay(url.searchParams.get("from"))
  const to = parseIsoDay(url.searchParams.get("to"))
  if (!from || !to) {
    return Response.json(
      { error: "Parâmetros from e to são obrigatórios (formato YYYY-MM-DD)." },
      { status: 400 },
    )
  }
  if (from > to) {
    return Response.json({ error: "A data inicial não pode ser posterior à final." }, { status: 400 })
  }
  if (daysBetweenInclusive(from, to) > MAX_RANGE_DAYS) {
    return Response.json(
      { error: `O intervalo máximo é de ${MAX_RANGE_DAYS} dias.` },
      { status: 400 },
    )
  }

  let targetUserId = session.user.id
  const requested = url.searchParams.get("userId")?.trim()
  const canViewOthers = can(role, "individual.viewOthers")
  const canViewTeamLancamentos = can(role, "equipe.lancamentos")

  if (requested && requested !== session.user.id) {
    if (!canViewOthers && !canViewTeamLancamentos) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const active = await getActiveQaUsers()
    const target = active.find((u) => u.id === requested)
    if (!target) {
      return Response.json({ error: "Utilizador não encontrado ou inativo." }, { status: 403 })
    }
    // MGR (canViewOthers) pode ver qualquer usuário ativo.
    // Outros admins com equipe.lancamentos só podem ver usuários dos seus perfis gerenciáveis.
    if (!canViewOthers) {
      const allowed = manageableProfiles(role)
      if (!target.accessProfile || !allowed.includes(target.accessProfile as "QA" | "UX" | "TW" | "MGR")) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
      }
    }
    targetUserId = requested
  }

  const [targetEmail, targetName] = await Promise.all([
    resolveEmailForQaUserId(targetUserId),
    resolveNameForQaUserId(targetUserId),
  ])
  if (!targetEmail) {
    return Response.json({ error: "Não foi possível resolver o e-mail deste cadastro." }, { status: 400 })
  }

  const resolved = await resolveJiraCredentialsForRequest(session.user.id)
  if (!resolved) {
    return Response.json(
      { error: "Configure a Integração Jira em Configurações para ver lançamentos." },
      { status: 400 },
    )
  }

  const { jiraUrl, jiraEmail: viewerEmail, apiToken } = resolved
  const base = jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${viewerEmail}:${apiToken}`).toString("base64")
  const timeZoneId = resolveTimeZoneForWorklogs(url.searchParams.get("tz"))
  const clockworkToken = (await getClockworkApiTokenResolved()).trim()

  const jiraUser = await findJiraAccountIdByEmail(base, credentials, targetEmail)

  let jiraEntries: Awaited<ReturnType<typeof fetchWorklogsForAuthorInRange>>["entries"] = []
  let truncatedIssues = false
  let truncatedWorklogs = false
  let jiraAuthorDisplayName: string | null = null

  if (jiraUser) {
    jiraAuthorDisplayName = jiraUser.displayName ?? null
    const fetched = await fetchWorklogsForAuthorInRange(
      base,
      credentials,
      jiraUser.accountId,
      from,
      to,
      timeZoneId,
    )
    jiraEntries = fetched.entries
    truncatedIssues = fetched.truncatedIssues
    truncatedWorklogs = fetched.truncatedWorklogs
  }

  let clockworkEntries: typeof jiraEntries = []
  if (clockworkToken) {
    try {
      clockworkEntries = await fetchClockworkWorklogsForEmail({
        token: clockworkToken,
        emailNorm: normalizeEmailForClockwork(targetEmail),
        fromIso: from,
        toIso: to,
        timeZoneId,
      })
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api/jira/lancamentos] Clockwork fetch failed", e)
      }
    }
  }

  const { merged: rawEntries, clockworkAdded } = mergeJiraAndClockworkWorklogs(jiraEntries, clockworkEntries)

  // Enriquece TODAS as chaves — o enrichment (busca direta por key) é a fonte
  // mais confiável para summary, priority, issueType e qtdCenariosQA.
  const keysToEnrich = Array.from(
    new Set(
      rawEntries
        .map((e) => e.issueKey.trim().toUpperCase())
        .filter((k) => JIRA_KEY_PATTERN.test(k)),
    ),
  )

  const brokenCountsPromise =
    keysToEnrich.length > 0
      ? brokenTestSubtasksCountsInParents(base, credentials, keysToEnrich, jiraUser?.accountId ?? null).catch(
          (e) => {
            if (process.env.NODE_ENV !== "production") {
              console.error("[api/jira/lancamentos] Broken Test counts failed", e)
            }
            return { totalInScope: 0, createdByReporter: 0 } satisfies BrokenTestSubtaskCounts
          },
        )
      : Promise.resolve(undefined)

  const enrichPromise =
    keysToEnrich.length > 0
      ? fetchIssueFieldsForKeys(base, credentials, keysToEnrich).catch(() => new Map<string, LancamentoIssueFieldsPatch>())
      : Promise.resolve(new Map<string, LancamentoIssueFieldsPatch>())

  // Retorno de Testes uses the same date range as the rest of the period filter.
  const reporterCountFrom = from
  // Prefer the name from our own DB over Jira's displayName — when Jira hides
  // emails by privacy, findJiraAccountIdByEmail may pick the wrong user, so
  // its displayName would also be wrong. Our DB name is the source of truth.
  const reporterNameFallback = targetName?.trim() || jiraUser?.displayName?.trim() || undefined
  const emptyDiagnostics: ReporterCountDiagnostics = { count: 0, attempts: [], accountIdsTried: [] }
  const reporterCountPromise: Promise<ReporterCountDiagnostics> =
    jiraUser || reporterNameFallback
      ? countReporterIssuesByTypes(
          base,
          credentials,
          jiraUser?.accountId ?? "",
          reporterCountFrom,
          to,
          reporterNameFallback,
        ).catch(() => emptyDiagnostics)
      : Promise.resolve(emptyDiagnostics)

  const [fieldMap, brokenCounts, reporterDiagnostics] = await Promise.all([
    enrichPromise,
    brokenCountsPromise,
    reporterCountPromise,
  ])
  const reporterBrokenTestIssueCount = reporterDiagnostics.count

  if (keysToEnrich.length > 0) {
    await augmentFieldMapWithGetIssueFallback(base, credentials, fieldMap, keysToEnrich)
  }

  let entries = rawEntries
  if (keysToEnrich.length > 0) {
    entries = rawEntries.map((e) => {
      const patch = fieldMap.get(e.issueKey.trim().toUpperCase())
      return patch ? mergeEntryWithPatch(e, patch) : e
    })
  }

  const totalSeconds = entries.reduce((acc, e) => acc + e.timeSpentSeconds, 0)
  const longSessionCount = entries.filter((e) => e.isLongSession).length
  const noJiraUser = !jiraUser

  const _debug = {
    targetEmail,
    targetName,
    jiraUserFound: !!jiraUser,
    jiraAccountIdFromEmail: jiraUser?.accountId ?? null,
    jiraDisplayNameFromEmail: jiraUser?.displayName ?? null,
    reporterCountFrom,
    reporterCountTo: to,
    reporterBrokenTestIssueCount,
    reporterAccountIdsTried: reporterDiagnostics.accountIdsTried,
    reporterAttempts: reporterDiagnostics.attempts,
  }

  if (noJiraUser && entries.length === 0) {
    return Response.json({
      source: "jira" as const,
      entries: [] as const,
      totalSeconds: 0,
      longSessionCount: 0,
      truncatedIssues: false,
      truncatedWorklogs: false,
      noJiraUser: true,
      jiraBrowseBase: base,
      includesClockwork: false,
      clockworkMergedCount: 0,
      reporterBrokenTestIssueCount: 0,
      message: "Nenhum registro encontrado",
      _debug,
    })
  }

  return Response.json({
    source: "jira" as const,
    entries,
    totalSeconds,
    longSessionCount,
    truncatedIssues,
    truncatedWorklogs,
    noJiraUser,
    jiraBrowseBase: base,
    jiraAuthorDisplayName,
    includesClockwork: clockworkAdded > 0,
    clockworkMergedCount: clockworkAdded,
    reporterBrokenTestIssueCount,
    _debug,
    ...(brokenCounts
      ? {
          brokenTestSubtasksTotalInScope: brokenCounts.totalInScope,
          brokenTestsCreatedByUser: brokenCounts.createdByReporter,
          brokenTestsOpenedCount: brokenCounts.createdByReporter,
        }
      : {}),
  })
}
