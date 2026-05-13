/**
 * Busca worklogs Jira Cloud para um accountId num intervalo (via JQL + worklogs por issue).
 * Usa credenciais Basic do utilizador que faz o pedido (viewer).
 */

const MAX_ISSUES = 80
const SEARCH_PAGE = 40
const MAX_WORKLOGS_TOTAL = 500
const LONG_SESSION_SECONDS = 8 * 3600

export type JiraLancamentoEntry = {
  id: string
  issueKey: string
  summary: string | null
  started: string
  timeSpentSeconds: number
  hours: number
  isLongSession: boolean
  comment: string | null
}

function jqlDateFromIso(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  return `${m[1]}/${m[2]}/${m[3]}`
}

function adfToPlain(node: unknown): string {
  if (node == null) return ""
  if (typeof node === "string") return node
  if (typeof node !== "object") return ""
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === "text" && typeof n.text === "string") return n.text
  if (Array.isArray(n.content)) return n.content.map(adfToPlain).join("")
  return ""
}

export function worklogCommentToPlain(comment: unknown): string | null {
  if (comment == null) return null
  if (typeof comment === "string") {
    const t = comment.trim()
    return t.length ? t : null
  }
  if (typeof comment === "object") {
    const plain = adfToPlain(comment).trim()
    return plain.length ? plain : null
  }
  return null
}

/**
 * Dia civil YYYY-MM-DD do instante `started` (ISO) num fuso IANA.
 * Deve coincidir com o mesmo critério usado nos presets (data local do utilizador).
 */
export function calendarDayKeyInTimeZone(startedIso: string, timeZone: string): string | null {
  const d = new Date(startedIso)
  if (Number.isNaN(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d)
    const y = parts.find((p) => p.type === "year")?.value
    const mo = parts.find((p) => p.type === "month")?.value
    const da = parts.find((p) => p.type === "day")?.value
    if (!y || !mo || !da) return null
    return `${y}-${mo}-${da}`
  } catch {
    return null
  }
}

/** Valida IANA básico e suporte do motor; fallback UTC. */
export function resolveTimeZoneForWorklogs(raw: string | null | undefined): string {
  const t = raw?.trim()
  if (!t || t.length > 80 || !/^[A-Za-z0-9_/+-]+$/.test(t)) return "UTC"
  try {
    new Intl.DateTimeFormat("en", { timeZone: t }).format(new Date())
    return t
  } catch {
    return "UTC"
  }
}

function dayInRange(dayKey: string, fromIso: string, toIso: string): boolean {
  return dayKey >= fromIso && dayKey <= toIso
}

async function jiraJson<T>(
  url: string,
  credentials: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const text = await res.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data, text }
}

export async function findJiraAccountIdByEmail(
  base: string,
  credentials: string,
  emailNorm: string,
): Promise<{ accountId: string; displayName?: string } | null> {
  const url = `${base}/rest/api/3/user/search?query=${encodeURIComponent(emailNorm)}&maxResults=20`
  const { ok, data } = await jiraJson<{ accountId: string; displayName?: string; emailAddress?: string }[]>(
    url,
    credentials,
  )
  if (!ok || !Array.isArray(data)) return null
  const lower = emailNorm.toLowerCase()
  const exact = data.find((u) => (u.emailAddress ?? "").trim().toLowerCase() === lower)
  const pick = exact ?? data[0]
  if (!pick?.accountId) return null
  return { accountId: pick.accountId, displayName: pick.displayName }
}

async function searchIssuesByJql(
  base: string,
  credentials: string,
  jql: string,
  startAt: number,
): Promise<{
  issues: { key: string; fields?: { summary?: string } }[]
  total: number
} | null> {
  const searchUrl = `${base}/rest/api/3/search`
  const { ok, data, status } = await jiraJson<{
    issues?: { key: string; fields?: { summary?: string } }[]
    total?: number
    startAt?: number
    maxResults?: number
  }>(searchUrl, credentials, {
    method: "POST",
    body: JSON.stringify({
      jql,
      fields: ["summary"],
      maxResults: SEARCH_PAGE,
      startAt,
    }),
  })
  if (!ok || !data?.issues) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[jira-worklogs-fetch] search failed", status, data)
    }
    return null
  }
  return { issues: data.issues, total: data.total ?? data.issues.length }
}

export async function fetchWorklogsForAuthorInRange(
  base: string,
  credentials: string,
  accountId: string,
  fromIso: string,
  toIso: string,
  timeZoneId: string,
): Promise<{ entries: JiraLancamentoEntry[]; truncatedIssues: boolean; truncatedWorklogs: boolean }> {
  const jFrom = jqlDateFromIso(fromIso)
  const jTo = jqlDateFromIso(toIso)
  if (!jFrom || !jTo) {
    return { entries: [], truncatedIssues: false, truncatedWorklogs: false }
  }

  const escaped = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jqlDated = `worklogAuthor = "${escaped}" AND worklogDate >= "${jFrom}" AND worklogDate <= "${jTo}" ORDER BY updated DESC`
  const jqlFallback = `worklogAuthor = "${escaped}" ORDER BY updated DESC`

  const issueKeys: string[] = []
  const summaries = new Map<string, string | null>()
  let startAt = 0
  let total = 0

  const runSearch = async (jql: string, capIssues: number) => {
    startAt = 0
    total = 0
    issueKeys.length = 0
    summaries.clear()
    do {
      const batch = await searchIssuesByJql(base, credentials, jql, startAt)
      if (!batch) break
      total = batch.total
      for (const issue of batch.issues) {
        if (issueKeys.length >= capIssues) break
        if (!issueKeys.includes(issue.key)) {
          issueKeys.push(issue.key)
          summaries.set(issue.key, issue.fields?.summary ?? null)
        }
      }
      startAt += batch.issues.length
      if (issueKeys.length >= capIssues || startAt >= total || batch.issues.length === 0) break
    } while (true)
  }

  await runSearch(jqlDated, MAX_ISSUES)
  if (issueKeys.length === 0) {
    await runSearch(jqlFallback, Math.min(50, MAX_ISSUES))
  }

  const truncatedIssues = total > issueKeys.length || issueKeys.length >= MAX_ISSUES

  const entries: JiraLancamentoEntry[] = []

  for (const issueKey of issueKeys) {
    if (entries.length >= MAX_WORKLOGS_TOTAL) break
    let wlStart = 0
    const wlUrlBase = `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog`
    for (;;) {
      const wlUrl = `${wlUrlBase}?startAt=${wlStart}&maxResults=100`
      const { ok, data } = await jiraJson<{
        worklogs?: {
          id: string
          author?: { accountId?: string }
          started?: string
          timeSpentSeconds?: number
          comment?: unknown
        }[]
        total?: number
      }>(wlUrl, credentials)

      if (!ok || !data?.worklogs) break

      for (const w of data.worklogs) {
        if (w.author?.accountId !== accountId) continue
        const started = w.started
        if (!started || w.timeSpentSeconds == null) continue
        const day = calendarDayKeyInTimeZone(started, timeZoneId)
        if (!day || !dayInRange(day, fromIso, toIso)) continue
        entries.push({
          id: `${issueKey}-${w.id}`,
          issueKey,
          summary: summaries.get(issueKey) ?? null,
          started,
          timeSpentSeconds: w.timeSpentSeconds,
          hours: Math.round((w.timeSpentSeconds / 3600) * 100) / 100,
          isLongSession: w.timeSpentSeconds > LONG_SESSION_SECONDS,
          comment: worklogCommentToPlain(w.comment),
        })
        if (entries.length >= MAX_WORKLOGS_TOTAL) break
      }

      wlStart += data.worklogs.length
      const wlTotal = data.total ?? wlStart
      if (entries.length >= MAX_WORKLOGS_TOTAL || wlStart >= wlTotal || data.worklogs.length === 0) break
    }
  }

  entries.sort((a, b) => (a.started < b.started ? 1 : a.started > b.started ? -1 : 0))

  return {
    entries,
    truncatedIssues,
    truncatedWorklogs: entries.length >= MAX_WORKLOGS_TOTAL,
  }
}
