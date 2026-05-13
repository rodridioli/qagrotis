import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import {
  fetchClockworkWorklogsForEmail,
  mergeJiraAndClockworkWorklogs,
} from "@/features/qa/lib/clockwork-worklogs-fetch"
import {
  fetchWorklogsForAuthorInRange,
  findJiraAccountIdByEmail,
  resolveTimeZoneForWorklogs,
} from "@/features/qa/lib/jira-worklogs-fetch"
import { getActiveQaUsers, resolveEmailForQaUserId } from "@/features/usuarios/actions/usuarios"
import type { NextRequest } from "next/server"

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_RANGE_DAYS = 92

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

export async function GET(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.lancamentos")) {
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

  if (requested && requested !== session.user.id) {
    if (!canViewOthers) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const active = await getActiveQaUsers()
    const allowed = new Set(active.map((u) => u.id))
    if (!allowed.has(requested)) {
      return Response.json({ error: "Utilizador não encontrado ou inativo." }, { status: 403 })
    }
    targetUserId = requested
  }

  const targetEmail = await resolveEmailForQaUserId(targetUserId)
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

  const { merged: entries, clockworkAdded } = mergeJiraAndClockworkWorklogs(jiraEntries, clockworkEntries)
  const totalSeconds = entries.reduce((acc, e) => acc + e.timeSpentSeconds, 0)
  const longSessionCount = entries.filter((e) => e.isLongSession).length
  const noJiraUser = !jiraUser

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
      message: clockworkToken
        ? "Não foi encontrado utilizador Jira com este e-mail e a API Clockwork não devolveu lançamentos no intervalo (confirme o token Pro em Configurações e o e-mail no Clockwork)."
        : "Não foi encontrado um utilizador Jira com o mesmo e-mail deste cadastro (ou o token não tem permissão de pesquisa). Em Configurações → Integração Clockwork (Administrador MGR) ou CLOCKWORK_API_TOKEN no servidor pode incluir horas só via Clockwork.",
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
  })
}
