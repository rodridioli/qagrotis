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
  projectKey: string
  projectName?: string | null
  summary: string | null
  issueType?: string | null
  priority?: string | null
  labels?: string[]
  qtdCenariosQA?: number | null
  started: string
  timeSpentSeconds: number
  hours: number
  isLongSession: boolean
  comment: string | null
  /** Presente quando o registo veio da API Clockwork (fundido com Jira). */
  dataSource?: "jira" | "clockwork"
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

/** Fields Jira search/issue — declarado cedo para `fetchIssueFieldsForKeys`. */
type IssueFields = {
  summary?: unknown
  issuetype?: { name?: string }
  priority?: unknown
  labels?: string[]
  project?: { name?: string; key?: string }
  [key: string]: unknown
}

function summaryFromIssueField(raw: unknown): string | null {
  if (typeof raw === "string") {
    const t = raw.trim()
    return t.length ? t : null
  }
  const plain = adfToPlain(raw).trim()
  return plain.length ? plain : null
}

function priorityNameFromIssueField(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === "string") {
    const t = raw.trim()
    return t.length ? t : null
  }
  if (typeof raw === "object") {
    const o = raw as { name?: unknown; displayName?: unknown }
    if (typeof o.name === "string" && o.name.trim()) return o.name.trim()
    if (typeof o.displayName === "string" && o.displayName.trim()) return o.displayName.trim()
  }
  return null
}

/**
 * Frase JQL de issuetype(s) para regressão de testes. Override: JIRA_BROKEN_TEST_ISSUE_TYPES="Broken Test,Teste Quebrado"
 */
function brokenTestIssuetypeClauseJql(): string {
  const raw = process.env.JIRA_BROKEN_TEST_ISSUE_TYPES?.trim()
  const parts = raw
    ? raw
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const names = parts.length > 0 ? parts : ["Broken Test"]
  const unique = [...new Set(names)]

  function quoteName(name: string): string {
    return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  if (unique.length === 1) return `issuetype = ${quoteName(unique[0]!)}`
  return `issuetype in (${unique.map((n) => quoteName(n)).join(", ")})`
}

// ── Bulk issue fields (summary, tipo, prioridade, Qtd. Cenários QA) ────────────

const SEARCH_KEY_CHUNK = 50
const MAX_BROKEN_TEST_SEARCH_TOTAL = 500

/** Patch aplicável por issue key (uppercase) para enriquecer linhas Clockwork ou incompletas. */
export type LancamentoIssueFieldsPatch = {
  summary: string | null
  issueType: string | null
  priority: string | null
  labels: string[]
  qtdCenariosQA: number | null
  projectName: string | null
}

function parseQtdCenariosQAFieldValue(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") {
    const t = raw.trim()
    const n = Number(t.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  if (typeof raw === "object") {
    const o = raw as { value?: unknown; name?: unknown; number?: unknown; amount?: unknown }
    if (o.value !== undefined) return parseQtdCenariosQAFieldValue(o.value)
    if (o.name !== undefined) return parseQtdCenariosQAFieldValue(o.name)
    if (o.number !== undefined) return parseQtdCenariosQAFieldValue(o.number)
    if (o.amount !== undefined) return parseQtdCenariosQAFieldValue(o.amount)
  }
  return null
}

function issueFieldsToLancamentoPatch(
  fields: IssueFields | undefined,
  qtdFieldId: string | null,
): LancamentoIssueFieldsPatch {
  const f = fields ?? {}
  const summary = summaryFromIssueField(f.summary)
  const issueType =
    typeof f.issuetype?.name === "string" && f.issuetype.name.trim() ? f.issuetype.name.trim() : null
  const priority = priorityNameFromIssueField(f.priority)
  const labels = Array.isArray(f.labels) ? (f.labels as string[]) : []
  const projectName =
    typeof f.project?.name === "string" && f.project.name.trim() ? f.project.name.trim() : null
  let qtdCenariosQA: number | null = null
  if (qtdFieldId && f[qtdFieldId] != null) {
    qtdCenariosQA = parseQtdCenariosQAFieldValue(f[qtdFieldId])
  }
  return {
    summary,
    issueType,
    priority,
    labels,
    qtdCenariosQA,
    projectName,
  }
}
/**
 * Pesquisa em lote fields necessários para a UI de lançamentos (chunks ~50 keys).
 * Falhas são ignoradas por chunk — merge parcial é aceitável.
 */
export async function fetchIssueFieldsForKeys(
  base: string,
  credentials: string,
  keys: string[],
): Promise<Map<string, LancamentoIssueFieldsPatch>> {
  const unique = Array.from(new Set(keys.map((k) => k.trim().toUpperCase()).filter((k) => /^[A-Z][A-Z0-9]*-\d+$/i.test(k))))
  const qtdFieldId = await resolveQtdCenariosQAFieldId(base, credentials)
  const baseFields = ["summary", "issuetype", "priority", "labels", "project"]
  const fieldsParam = qtdFieldId ? [...baseFields, qtdFieldId] : baseFields

  const result = new Map<string, LancamentoIssueFieldsPatch>()
  for (let i = 0; i < unique.length; i += SEARCH_KEY_CHUNK) {
    const chunk = unique.slice(i, i + SEARCH_KEY_CHUNK)
    const quoted = chunk.map((k) => `"${k.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(", ")
    const jql = `key in (${quoted})`
    try {
      const { ok, data } = await jiraJson<{
        issues?: {
          key: string
          fields?: IssueFields
        }[]
      }>(`${base}/rest/api/3/search`, credentials, {
        method: "POST",
        body: JSON.stringify({ jql, fields: fieldsParam, maxResults: SEARCH_KEY_CHUNK }),
      })
      if (ok && Array.isArray(data?.issues)) {
        for (const issue of data.issues) {
          result.set(
            issue.key.trim().toUpperCase(),
            issueFieldsToLancamentoPatch(issue.fields, qtdFieldId),
          )
        }
      }
    } catch {
      // non-fatal
    }
  }
  return result
}

const MAX_ISSUE_FIELDS_FALLBACK_GET = 72
const FALLBACK_GET_CONCURRENCY = 10

async function paginateBrokenTestSubtaskCount(base: string, credentials: string, jql: string): Promise<number> {
  let startAt = 0
  let chunkCount = 0
  const pageSize = 50

  try {
    for (;;) {
      const { ok, data } = await jiraJson<{
        issues?: unknown[]
        total?: number
      }>(`${base}/rest/api/3/search`, credentials, {
        method: "POST",
        body: JSON.stringify({ jql, fields: ["summary"], maxResults: pageSize, startAt }),
      })
      if (!ok || !data) break
      const n = Array.isArray(data.issues) ? data.issues.length : 0
      if (n === 0) break
      chunkCount += n
      const reportedTotal = typeof data.total === "number" ? data.total : chunkCount
      startAt += n
      if (startAt >= reportedTotal || chunkCount >= MAX_BROKEN_TEST_SEARCH_TOTAL) break
    }
  } catch {
    // non-fatal
  }

  return Math.min(chunkCount, MAX_BROKEN_TEST_SEARCH_TOTAL)
}

/** Subtarefas Broken Test com parent nos worklogs avaliados. */
export type BrokenTestSubtaskCounts = {
  /** Todas subtarefas do tipo Broken Test cujo parent está nos worklogs relevantes. */
  totalInScope: number
  /** Subconjunto reportado pela conta avaliada. */
  createdByReporter: number
}

/**
 * Para cada chunks de parent's: conta todas as subtarefas Broken Test e as criadas pelo reporter.
 */
export async function brokenTestSubtasksCountsInParents(
  base: string,
  credentials: string,
  parentKeys: string[],
  reporterAccountId: string | null,
): Promise<BrokenTestSubtaskCounts> {
  const unique = Array.from(new Set(parentKeys.filter((k) => /^[A-Z][A-Z0-9]*-\d+$/i.test(k))))
  if (unique.length === 0) return { totalInScope: 0, createdByReporter: 0 }

  let totalInScope = 0
  let createdByReporter = 0
  const PARENT_CHUNK = 50
  const escapedReporter = reporterAccountId
    ? reporterAccountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    : ""

  for (let i = 0; i < unique.length; i += PARENT_CHUNK) {
    const chunk = unique.slice(i, i + PARENT_CHUNK)
    const quoted = chunk.map((k) => `"${k.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(", ")

    const baseJql = `${brokenTestIssuetypeClauseJql()} AND parent in (${quoted})`

    totalInScope += await paginateBrokenTestSubtaskCount(base, credentials, baseJql)

    if (escapedReporter.length > 0) {
      const jqlReporter = `${baseJql} AND reporter = "${escapedReporter}"`
      createdByReporter += await paginateBrokenTestSubtaskCount(base, credentials, jqlReporter)
    }
  }

  return {
    totalInScope: Math.min(totalInScope, MAX_BROKEN_TEST_SEARCH_TOTAL),
    createdByReporter: Math.min(createdByReporter, MAX_BROKEN_TEST_SEARCH_TOTAL),
  }
}

/**
 * Conta subtarefas do tipo Broken Test criadas pelo reporter em issues-pai cujas chaves
 * estão em parentKeys (os Jiras onde o usuário apontou horas).
 * Faz chunks de 50 chaves para não exceder o limite da JQL.
 */
export async function countBrokenTestSubtasksInParentIssues(
  base: string,
  credentials: string,
  parentKeys: string[],
  reporterAccountId: string,
): Promise<number> {
  const c = await brokenTestSubtasksCountsInParents(base, credentials, parentKeys, reporterAccountId)
  return c.createdByReporter
}

export function mergeLancamentoIssuePatches(
  prev: LancamentoIssueFieldsPatch | undefined,
  next: LancamentoIssueFieldsPatch,
): LancamentoIssueFieldsPatch {
  return {
    summary: next.summary?.trim()
      ? next.summary.trim()
      : prev?.summary?.trim()
        ? prev.summary.trim()
        : null,
    issueType: next.issueType?.trim()
      ? next.issueType.trim()
      : prev?.issueType?.trim()
        ? prev.issueType.trim()
        : null,
    priority: next.priority?.trim()
      ? next.priority.trim()
      : prev?.priority?.trim()
        ? prev.priority.trim()
        : null,
    labels: next.labels.length ? next.labels : prev?.labels?.length ? prev.labels : [],
    qtdCenariosQA:
      next.qtdCenariosQA != null && Number.isFinite(next.qtdCenariosQA)
        ? next.qtdCenariosQA
        : prev?.qtdCenariosQA != null && Number.isFinite(prev.qtdCenariosQA)
          ? prev.qtdCenariosQA
          : null,
    projectName: next.projectName?.trim()
      ? next.projectName.trim()
      : prev?.projectName?.trim()
        ? prev.projectName.trim()
        : null,
  }
}

/**
 * GET /issue/{key} para chaves sem resumo ou prioridade após a search em lote (ex.: Clockwork).
 */
export async function augmentFieldMapWithGetIssueFallback(
  base: string,
  credentials: string,
  fieldMap: Map<string, LancamentoIssueFieldsPatch>,
  allKeysUppercase: string[],
): Promise<void> {
  const qtdFieldId = await resolveQtdCenariosQAFieldId(base, credentials)

  const unique = Array.from(new Set(allKeysUppercase.map((k) => k.trim().toUpperCase())))
  const need = unique
    .filter((k) => /^[A-Z][A-Z0-9]*-\d+$/i.test(k))
    .filter((k) => {
      const p = fieldMap.get(k)
      if (!p) return true
      const missMeta = !p.summary?.trim() || !p.priority?.trim()
      const missQtd =
        qtdFieldId != null &&
        (p.qtdCenariosQA == null || !Number.isFinite(p.qtdCenariosQA))
      return missMeta || missQtd
    })
    .slice(0, MAX_ISSUE_FIELDS_FALLBACK_GET)

  if (need.length === 0) return

  const fieldNames = ["summary", "issuetype", "priority", "labels", "project"]
  if (qtdFieldId) fieldNames.push(qtdFieldId)
  const fieldsComma = fieldNames.join(",")

  for (let i = 0; i < need.length; i += FALLBACK_GET_CONCURRENCY) {
    const slice = need.slice(i, i + FALLBACK_GET_CONCURRENCY)
    await Promise.all(
      slice.map(async (key) => {
        try {
          const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fieldsComma}`
          const { ok, data } = await jiraJson<{ fields?: IssueFields }>(url, credentials)
          if (!ok || !data?.fields) return
          const patch = issueFieldsToLancamentoPatch(data.fields, qtdFieldId)
          fieldMap.set(key, mergeLancamentoIssuePatches(fieldMap.get(key), patch))
        } catch {
          // non-fatal
        }
      }),
    )
  }
}

/**
 * Conta issues/subtarefas do tipo Broken Test criadas no intervalo com reporter = accountId.
 * @deprecated Prefer countBrokenTestSubtasksInParentIssues for worklog-scoped counting.
 */
export async function countBrokenTestsOpenedByReporterInRange(
  base: string,
  credentials: string,
  accountId: string,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const jFrom = jqlDateFromIso(fromIso)
  const jTo = jqlDateFromIso(toIso)
  if (!jFrom || !jTo) return 0

  const escaped = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jql =
    `reporter = "${escaped}" AND issuetype = "Broken Test" ` +
    `AND created >= "${jFrom}" AND created <= "${jTo}"`

  let fetchedCount = 0
  let startAt = 0
  const pageSize = 50

  try {
    for (;;) {
      const { ok, data } = await jiraJson<{
        issues?: unknown[]
        total?: number
      }>(`${base}/rest/api/3/search`, credentials, {
        method: "POST",
        body: JSON.stringify({
          jql,
          fields: ["summary"],
          maxResults: pageSize,
          startAt,
        }),
      })
      if (!ok || !data) break
      const n = Array.isArray(data.issues) ? data.issues.length : 0
      if (n === 0) break
      fetchedCount += n
      const reportedTotal = typeof data.total === "number" ? data.total : fetchedCount
      startAt += n
      if (startAt >= reportedTotal || fetchedCount >= MAX_BROKEN_TEST_SEARCH_TOTAL) break
    }
  } catch {
    return fetchedCount
  }

  return Math.min(fetchedCount, MAX_BROKEN_TEST_SEARCH_TOTAL)
}

/**
 * Conta issues onde reporter = accountId e issuetype ∈ {Broken Test, Erro Teste, …}
 * criadas dentro do intervalo [fromIso, toIso]. Usa paginação segura.
 * Tipos configuráveis via env JIRA_BROKEN_TEST_ISSUE_TYPES (csv). "Erro Teste" é sempre incluído.
 */
export async function countReporterIssuesByTypes(
  base: string,
  credentials: string,
  accountId: string,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const raw = process.env.JIRA_BROKEN_TEST_ISSUE_TYPES?.trim()
  const fromEnv = raw
    ? raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
    : []
  const allNames = [...new Set(fromEnv.length > 0 ? fromEnv : ["Broken Test"])]

  function quoteName(name: string): string {
    return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  const issuetypeClause =
    allNames.length === 1
      ? `issuetype = ${quoteName(allNames[0]!)}`
      : `issuetype in (${allNames.map((n) => quoteName(n)).join(", ")})`

  // toNextDay = toIso + 1 day, used for the exclusive upper bound on created
  const toDate = new Date(toIso + "T00:00:00Z")
  toDate.setUTCDate(toDate.getUTCDate() + 1)
  const toNextDay = toDate.toISOString().slice(0, 10)

  const escapedAccount = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jql = `reporter = "${escapedAccount}" AND ${issuetypeClause} AND status != "Cancelado" AND created >= "${fromIso}" AND created < "${toNextDay}"`

  console.log("[countReporterIssuesByTypes] jql:", jql)

  let fetchedCount = 0
  let startAt = 0
  const pageSize = 50

  try {
    for (;;) {
      const { ok, data, status, text } = await jiraJson<{
        issues?: unknown[]
        total?: number
      }>(`${base}/rest/api/3/search`, credentials, {
        method: "POST",
        body: JSON.stringify({
          jql,
          fields: ["summary"],
          maxResults: pageSize,
          startAt,
        }),
      })
      if (!ok || !data) {
        console.error("[countReporterIssuesByTypes] Jira search failed", { status, jql, body: text?.slice(0, 400) })
        break
      }
      const n = Array.isArray(data.issues) ? data.issues.length : 0
      if (n === 0) break
      fetchedCount += n
      const reportedTotal = typeof data.total === "number" ? data.total : fetchedCount
      startAt += n
      if (startAt >= reportedTotal || fetchedCount >= MAX_BROKEN_TEST_SEARCH_TOTAL) break
    }
  } catch (err) {
    console.error("[countReporterIssuesByTypes] unexpected error", err)
    return fetchedCount
  }

  console.log("[countReporterIssuesByTypes] result:", fetchedCount)
  return Math.min(fetchedCount, MAX_BROKEN_TEST_SEARCH_TOTAL)
}

// ── Custom field discovery ────────────────────────────────────────────────────
// Cache the resolved field ID for the lifetime of the process to avoid
// repeated GET /rest/api/3/field calls on every request.
/** Override com ID fixo (`customfield_123`), útil quando o nome no Jira diverge do padrão. */
const QTD_ENV_FIELD_ID = process.env.JIRA_QTD_CENARIOS_QA_FIELD_ID?.trim()

let cachedQtdCenariosQAFieldId: string | null | undefined = undefined

export async function resolveQtdCenariosQAFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  if (QTD_ENV_FIELD_ID) return QTD_ENV_FIELD_ID
  if (cachedQtdCenariosQAFieldId !== undefined) return cachedQtdCenariosQAFieldId

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedQtdCenariosQAFieldId = null
      return null
    }
    const patterns = [
      /qtd\.?\s*cen[aá]rios\s*qa\b/i,
      /\bqta\.?\s*cen[aá]rios\s*qa\b/i,
      /\bcen[aá]rios\s*qa\b/i,
      /\bqa\s*cen[aá]rios\b/i,
    ]
    const found = data.find((f) => patterns.some((re) => re.test(f.name)))
    cachedQtdCenariosQAFieldId = found?.id ?? null
  } catch {
    cachedQtdCenariosQAFieldId = null
  }

  return cachedQtdCenariosQAFieldId
}

// ── Issue search ──────────────────────────────────────────────────────────────

async function searchIssuesByJql(
  base: string,
  credentials: string,
  jql: string,
  startAt: number,
  extraFields: string[],
): Promise<{
  issues: { key: string; fields?: IssueFields }[]
  total: number
} | null> {
  const searchUrl = `${base}/rest/api/3/search`
  const { ok, data, status } = await jiraJson<{
    issues?: { key: string; fields?: IssueFields }[]
    total?: number
    startAt?: number
    maxResults?: number
  }>(searchUrl, credentials, {
    method: "POST",
    body: JSON.stringify({
      jql,
      fields: ["summary", "issuetype", "priority", "labels", ...extraFields],
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

  const qtdFieldId = await resolveQtdCenariosQAFieldId(base, credentials)
  const extraFields = qtdFieldId ? [qtdFieldId] : []

  const escaped = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jqlDated = `worklogAuthor = "${escaped}" AND worklogDate >= "${jFrom}" AND worklogDate <= "${jTo}" ORDER BY updated DESC`
  const jqlFallback = `worklogAuthor = "${escaped}" ORDER BY updated DESC`

  const issueKeys: string[] = []
  const issueFieldsMap = new Map<string, IssueFields>()
  let startAt = 0
  let total = 0

  const runSearch = async (jql: string, capIssues: number) => {
    startAt = 0
    total = 0
    issueKeys.length = 0
    issueFieldsMap.clear()
    do {
      const batch = await searchIssuesByJql(base, credentials, jql, startAt, extraFields)
      if (!batch) break
      total = batch.total
      for (const issue of batch.issues) {
        if (issueKeys.length >= capIssues) break
        if (!issueKeys.includes(issue.key)) {
          issueKeys.push(issue.key)
          issueFieldsMap.set(issue.key, issue.fields ?? {})
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
    const fields = issueFieldsMap.get(issueKey) ?? {}
    const patch = issueFieldsToLancamentoPatch(fields, qtdFieldId)
    const projectKey = issueKey.split("-")[0] ?? issueKey

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
          projectKey,
          summary: patch.summary,
          issueType: patch.issueType,
          priority: patch.priority,
          labels: patch.labels,
          qtdCenariosQA: patch.qtdCenariosQA,
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
