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

function dayKeyFromJiraStarted(started: string): string | null {
  const d = new Date(started)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
  const da = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
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

export async function fetchWorklogsForAuthorInRange(
  base: string,
  credentials: string,
  accountId: string,
  fromIso: string,
  toIso: string,
): Promise<{ entries: JiraLancamentoEntry[]; truncatedIssues: boolean; truncatedWorklogs: boolean }> {
  const jFrom = jqlDateFromIso(fromIso)
  const jTo = jqlDateFromIso(toIso)
  if (!jFrom || !jTo) {
    return { entries: [], truncatedIssues: false, truncatedWorklogs: false }
  }

  const escaped = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jql = `worklogAuthor = "${escaped}" AND worklogDate >= "${jFrom}" AND worklogDate <= "${jTo}" ORDER BY updated DESC`

  const issueKeys: string[] = []
  const summaries = new Map<string, string | null>()
  let startAt = 0
  let total = 0

  do {
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
      break
    }

    total = data.total ?? issueKeys.length
    for (const issue of data.issues) {
      if (issueKeys.length >= MAX_ISSUES) break
      issueKeys.push(issue.key)
      summaries.set(issue.key, issue.fields?.summary ?? null)
    }

    startAt += data.issues.length
    if (issueKeys.length >= MAX_ISSUES || startAt >= total || data.issues.length === 0) break
  } while (true)

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
        const day = dayKeyFromJiraStarted(started)
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
