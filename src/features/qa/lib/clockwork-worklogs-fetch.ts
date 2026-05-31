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

    // DEBUG — log first raw row to confirm field names (remove after verifying)
    if (out.length === 0 && data.length > 0) {
      console.log("[clockwork-worklogs-fetch] first raw row keys:", Object.keys(data[0] as object))
      console.log("[clockwork-worklogs-fetch] first raw row:", JSON.stringify(data[0]).slice(0, 500))
    }

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
}): Promise<{ ok: boolean; error?: string; clockworkDetail?: string }> {
  const { token, issueKey, startedAt, timeSpentSeconds, comment, authorEmail } = opts

  const baseBody: Record<string, unknown> = {
    issue: { key: issueKey },
    started: startedAt,
    timeSpentSeconds: Math.round(timeSpentSeconds),
  }
  if (comment?.trim()) baseBody.comment = comment.trim()

  async function postWorklog(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; text: string }> {
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
      const text = await res.text().catch(() => "")
      return { ok: res.ok, status: res.status, text }
    } catch (err) {
      return { ok: false, status: 0, text: String(err) }
    }
  }

  // 1ª tentativa: com author (atribuição correta)
  if (authorEmail?.trim()) {
    const withAuthor = { ...baseBody, author: { emailAddress: authorEmail.trim() } }
    const r = await postWorklog(withAuthor)
    if (r.ok) {
      console.info(`[clockwork] createClockworkWorklog: worklog criado para ${issueKey} (${timeSpentSeconds}s) com author`)
      return { ok: true }
    }
    console.warn(
      `[clockwork] createClockworkWorklog: status ${r.status} com author para ${issueKey} — tentando sem author. Detalhe: ${r.text.slice(0, 200)}`,
    )
    // Se for erro de cliente (4xx), tenta sem author (token pode não ter permissão "create on behalf of")
    // Se for erro de rede/timeout (status 0), propaga imediatamente
    if (r.status === 0) {
      return { ok: false, error: "Erro de rede ao contactar Clockwork.", clockworkDetail: r.text.slice(0, 300) }
    }
  }

  // 2ª tentativa: sem author (Clockwork atribui ao token owner)
  const r2 = await postWorklog(baseBody)
  if (r2.ok) {
    console.info(`[clockwork] createClockworkWorklog: worklog criado para ${issueKey} (${timeSpentSeconds}s) sem author`)
    return { ok: true }
  }

  console.error(
    `[clockwork] createClockworkWorklog: falhou (status ${r2.status}) para ${issueKey} —`,
    r2.text.slice(0, 300),
  )
  return {
    ok: false,
    error: `Clockwork HTTP ${r2.status || "network error"}`,
    clockworkDetail: r2.text.slice(0, 300),
  }
}

/**
 * Retorna o total de `timeSpentSeconds` de todos os worklogs do Clockwork
 * para um issueKey específico. Usa `issue_query[]` no endpoint /v1/worklogs.
 * Retorna 0 em caso de erro ou ausência de dados.
 */
export async function fetchClockworkTotalForIssue(opts: {
  token: string
  issueKey: string
}): Promise<number> {
  const { token, issueKey } = opts
  try {
    const url = new URL(`${CW_HOST}/v1/worklogs`)
    url.searchParams.append("issue_query[]", issueKey)
    url.searchParams.set("expand", "issues,worklogs")

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${token.trim()}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
    if (!res.ok) return 0

    let data: unknown
    try { data = await res.json() } catch { return 0 }
    if (!Array.isArray(data)) return 0

    return data.reduce((sum: number, row: unknown) => {
      if (!row || typeof row !== "object") return sum
      const r = row as CwRow
      const ts = r.timeSpentSeconds
      return typeof ts === "number" && Number.isFinite(ts) ? sum + ts : sum
    }, 0)
  } catch {
    return 0
  }
}

/**
 * Versão batch de `fetchClockworkTotalForIssue`.
 * Envia todos os issueKeys em uma única requisição HTTP ao Clockwork
 * usando múltiplos parâmetros `issue_query[]`, eliminando N round-trips.
 * Retorna mapa issueKey → totalSeconds (0 quando sem worklog ou erro).
 */
export async function fetchClockworkTotalsForIssues(opts: {
  token: string
  issueKeys: string[]
}): Promise<Record<string, number>> {
  const { token, issueKeys } = opts
  // Inicializa todos os keys com 0 (garante entrada mesmo sem worklog)
  const map: Record<string, number> = {}
  for (const key of issueKeys) map[key] = 0
  if (issueKeys.length === 0) return map

  try {
    const url = new URL(`${CW_HOST}/v1/worklogs`)
    for (const key of issueKeys) {
      url.searchParams.append("issue_query[]", key)
    }
    url.searchParams.set("expand", "issues,worklogs")

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${token.trim()}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    })
    if (!res.ok) return map

    let data: unknown
    try { data = await res.json() } catch { return map }
    if (!Array.isArray(data)) return map

    for (const row of data) {
      if (!row || typeof row !== "object") continue
      const r = row as CwRow
      const ts = r.timeSpentSeconds
      if (typeof ts !== "number" || !Number.isFinite(ts)) continue
      const key = typeof r.issue?.key === "string" ? r.issue.key.trim() : null
      if (key && key in map) map[key] += ts
    }

    return map
  } catch {
    return map
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
