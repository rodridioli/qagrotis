import type { JiraLancamentoEntry } from "@/features/qa/lib/jira-worklogs-fetch"

const CW_HOST = "https://api.clockwork.report"
const LONG_SESSION_SECONDS = 8 * 3600
const MAX_MERGED_FROM_CLOCKWORK = 1000

function dedupeMinuteKey(e: { issueKey: string; started: string; timeSpentSeconds: number }): string {
  const t = new Date(e.started).getTime()
  if (Number.isNaN(t)) return `${e.issueKey}|invalid|${e.timeSpentSeconds}`
  const minute = Math.floor(t / 60000)
  return `${e.issueKey.trim().toUpperCase()}|${minute}|${e.timeSpentSeconds}`
}

type CwIssue = { key?: string; id?: string | number; summary?: string }
type CwRow = {
  id?: string | number
  started?: string
  timeSpentSeconds?: number
  issue?: CwIssue
  comment?: string
}

function mapClockworkRow(raw: unknown): JiraLancamentoEntry | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as CwRow
  const started = r.started?.trim()
  const ts = r.timeSpentSeconds
  if (!started || typeof ts !== "number" || !Number.isFinite(ts)) return null
  const issue = r.issue
  const issueKey =
    (typeof issue?.key === "string" && issue.key.trim()) ||
    (issue?.id != null && String(issue.id).trim() ? `ID-${String(issue.id).trim()}` : "DESCONHECIDO")
  const projectKey = issueKey.includes("-") ? issueKey.split("-")[0] : issueKey
  const summary = typeof issue?.summary === "string" ? issue.summary : null
  const id = r.id != null ? String(r.id) : `${issueKey}-${started}-${ts}`
  const comment = typeof r.comment === "string" && r.comment.trim() ? r.comment.trim() : null
  return {
    id: `cw-${id}`,
    issueKey,
    projectKey,
    summary,
    issueType: null,
    priority: null,
    labels: [],
    qtdCenariosQA: null,
    started,
    timeSpentSeconds: ts,
    hours: Math.round((ts / 3600) * 100) / 100,
    isLongSession: ts > LONG_SESSION_SECONDS,
    comment,
    dataSource: "clockwork",
  }
}

/**
 * Worklogs Clockwork Pro (api.clockwork.report), filtrados por e-mail do autor.
 * Requer CLOCKWORK_API_TOKEN no servidor (Clockwork Pro → API tokens).
 */
export async function fetchClockworkWorklogsForEmail(opts: {
  token: string
  emailNorm: string
  fromIso: string
  toIso: string
  timeZoneId: string
}): Promise<JiraLancamentoEntry[]> {
  const { token, emailNorm, fromIso, toIso, timeZoneId } = opts
  const out: JiraLancamentoEntry[] = []
  let offset = 0

  while (out.length < MAX_MERGED_FROM_CLOCKWORK) {
    const url = new URL(`${CW_HOST}/v1/worklogs`)
    url.searchParams.set("starting_at", fromIso)
    url.searchParams.set("ending_at", toIso)
    url.searchParams.append("user_query[]", emailNorm)
    url.searchParams.set("expand", "issues,worklogs")
    if (timeZoneId && timeZoneId !== "UTC") {
      url.searchParams.set("tz", timeZoneId)
    }
    url.searchParams.set("offset", String(offset))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${token.trim()}` },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        const t = await res.text().catch(() => "")
        console.error("[clockwork-worklogs-fetch]", res.status, t.slice(0, 400))
      }
      break
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      break
    }
    if (!Array.isArray(data)) break

    for (const row of data) {
      if (out.length >= MAX_MERGED_FROM_CLOCKWORK) break
      const mapped = mapClockworkRow(row)
      if (mapped) out.push(mapped)
    }

    if (data.length === 0) break
    if (data.length < 10_000) break
    offset += data.length
  }

  return out
}

/**
 * Cria um worklog no Clockwork Pro via POST /v1/worklogs.
 * Retorna { ok: true } em caso de sucesso ou { ok: false, error } em caso de falha.
 * Não lança exceção — use try/catch apenas se quiser inspecionar o erro.
 *
 * @param opts.authorEmail  E-mail do autor (atribuição no Clockwork). Opcional.
 */
export async function createClockworkWorklog(opts: {
  token: string
  issueKey: string
  /** ISO 8601 UTC — início da sessão de trabalho. */
  startedAt: string
  timeSpentSeconds: number
  comment?: string | null
  authorEmail?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { token, issueKey, startedAt, timeSpentSeconds, comment, authorEmail } = opts

  const body: Record<string, unknown> = {
    issue: { key: issueKey },
    started: startedAt,
    timeSpentSeconds: Math.round(timeSpentSeconds),
  }
  if (comment?.trim()) body.comment = comment.trim()
  if (authorEmail?.trim()) body.author = { emailAddress: authorEmail.trim() }

  try {
    const res = await fetch(`${CW_HOST}/v1/worklogs`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token.trim()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error(
        `[clockwork] createClockworkWorklog: status ${res.status} para ${issueKey} —`,
        text.slice(0, 300),
      )
      return { ok: false, error: `Clockwork HTTP ${res.status}` }
    }
    console.info(`[clockwork] createClockworkWorklog: worklog criado para ${issueKey} (${timeSpentSeconds}s)`)
    return { ok: true }
  } catch (err) {
    console.error("[clockwork] createClockworkWorklog exception:", err, "para", issueKey)
    return { ok: false, error: String(err) }
  }
}

export function mergeJiraAndClockworkWorklogs(
  jira: JiraLancamentoEntry[],
  clockwork: JiraLancamentoEntry[],
): { merged: JiraLancamentoEntry[]; clockworkAdded: number } {
  const seen = new Set<string>()
  for (const e of jira) {
    seen.add(dedupeMinuteKey(e))
  }
  const merged: JiraLancamentoEntry[] = jira.map((e) => ({
    ...e,
    dataSource: e.dataSource ?? "jira",
  }))
  let clockworkAdded = 0
  for (const e of clockwork) {
    const k = dedupeMinuteKey(e)
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(e)
    clockworkAdded++
  }
  merged.sort((a, b) => (a.started < b.started ? 1 : a.started > b.started ? -1 : 0))
  return { merged, clockworkAdded }
}
