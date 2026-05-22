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
  qtdCenariosErro?: number | null
  typeField?: string | null
  /** Status atual da issue no Jira (ex: "Approval", "In Progress", "Done"). */
  status?: string | null
  tag?: string | null
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
    signal: AbortSignal.timeout(15_000),
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

/**
 * Procura todos os accountIds em Jira que correspondem a um nome de exibição.
 * Útil quando a privacidade de e-mail oculta o vínculo email→accountId — o nome
 * é uma busca alternativa que casa com o campo `reporter` das issues.
 *
 * Retorna match exato primeiro (case-insensitive); na ausência, prefixo/substring.
 */
export async function findJiraAccountIdsByDisplayName(
  base: string,
  credentials: string,
  displayName: string,
): Promise<{ accountId: string; displayName: string; emailAddress?: string }[]> {
  const name = displayName.trim()
  if (!name) return []
  const url = `${base}/rest/api/3/user/search?query=${encodeURIComponent(name)}&maxResults=20`
  const { ok, data } = await jiraJson<{ accountId: string; displayName?: string; emailAddress?: string }[]>(
    url,
    credentials,
  )
  if (!ok || !Array.isArray(data)) return []
  const lower = name.toLowerCase()
  const exact = data.filter((u) => (u.displayName ?? "").trim().toLowerCase() === lower)
  const pool = exact.length > 0 ? exact : data
  return pool
    .filter((u): u is { accountId: string; displayName: string; emailAddress?: string } =>
      typeof u.accountId === "string" && u.accountId.length > 0,
    )
    .map((u) => ({ accountId: u.accountId, displayName: u.displayName ?? "", emailAddress: u.emailAddress }))
}

/** Fields Jira search/issue — declarado cedo para `fetchIssueFieldsForKeys`. */
type IssueFields = {
  summary?: unknown
  issuetype?: { name?: string }
  priority?: unknown
  labels?: string[]
  project?: { name?: string; key?: string }
  status?: { name?: string }
  assignee?: { accountId?: string } | null
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
  qtdCenariosErro: number | null
  projectName: string | null
  typeField: string | null
  status: string | null
  tag: string | null
  assigneeAccountId: string | null
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

function parseTypeFieldValue(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === "string") {
    const t = raw.trim()
    return t.length ? t : null
  }
  // Label-type Jira fields return an array (e.g. ["PRO"])
  if (Array.isArray(raw)) {
    return raw.length > 0 ? parseTypeFieldValue(raw[0]) : null
  }
  if (typeof raw === "object") {
    const o = raw as { value?: unknown; name?: unknown }
    if (typeof o.value === "string" && o.value.trim()) return o.value.trim()
    if (typeof o.name === "string" && o.name.trim()) return o.name.trim()
  }
  return null
}

function issueFieldsToLancamentoPatch(
  fields: IssueFields | undefined,
  qtdFieldIds: string[],
  typeFieldId: string | null,
  qtdErroFieldIds: string[],
  tagFieldId: string | null,
): LancamentoIssueFieldsPatch {
  const f = fields ?? {}
  const summary = summaryFromIssueField(f.summary)
  const issueType =
    typeof f.issuetype?.name === "string" && f.issuetype.name.trim() ? f.issuetype.name.trim() : null
  const priority = priorityNameFromIssueField(f.priority)
  const labels = Array.isArray(f.labels) ? (f.labels as string[]) : []
  const projectName =
    typeof f.project?.name === "string" && f.project.name.trim() ? f.project.name.trim() : null
  // Itera todos os IDs resolvidos e usa o primeiro valor não-nulo encontrado.
  // Necessário porque projetos distintos podem ter campos custom com o mesmo
  // nome mas IDs diferentes (criados separadamente no Jira Cloud).
  let qtdCenariosQA: number | null = null
  for (const id of qtdFieldIds) {
    if (f[id] != null) {
      const v = parseQtdCenariosQAFieldValue(f[id])
      if (v != null) { qtdCenariosQA = v; break }
    }
  }
  let qtdCenariosErro: number | null = null
  for (const id of qtdErroFieldIds) {
    if (f[id] != null) {
      const v = parseQtdCenariosQAFieldValue(f[id])
      if (v != null) { qtdCenariosErro = v; break }
    }
  }
  const typeField = typeFieldId ? parseTypeFieldValue(f[typeFieldId]) : null
  const tag = tagFieldId ? parseTypeFieldValue(f[tagFieldId]) : null
  const status = typeof f.status?.name === "string" && f.status.name.trim() ? f.status.name.trim() : null
  const assigneeAccountId =
    f.assignee && typeof f.assignee === "object" && typeof f.assignee.accountId === "string" && f.assignee.accountId.trim()
      ? f.assignee.accountId.trim()
      : null
  return {
    summary,
    issueType,
    priority,
    labels,
    qtdCenariosQA,
    qtdCenariosErro,
    projectName,
    typeField,
    status,
    tag,
    assigneeAccountId,
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
  const [qtdFieldIds, typeFieldId, qtdErroFieldIds, tagFieldId] = await Promise.all([
    resolveQtdCenariosQAFieldIds(base, credentials),
    resolveTypeFieldId(base, credentials),
    resolveQtdCenariosErroFieldIds(base, credentials),
    resolveTagFieldId(base, credentials),
  ])
  const baseFields = ["summary", "issuetype", "priority", "labels", "project", "status", "assignee"]
  const fieldsParam = [...baseFields, ...qtdFieldIds, ...qtdErroFieldIds]
  if (typeFieldId) fieldsParam.push(typeFieldId)
  if (tagFieldId) fieldsParam.push(tagFieldId)

  const result = new Map<string, LancamentoIssueFieldsPatch>()
  for (let i = 0; i < unique.length; i += SEARCH_KEY_CHUNK) {
    const chunk = unique.slice(i, i + SEARCH_KEY_CHUNK)
    const quoted = chunk.map((k) => `"${k.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(", ")
    const jql = `key in (${quoted})`
    try {
      // New /search/jql endpoint (legacy /search is 410 Gone since May 2025).
      // Uses nextPageToken cursor pagination; for ≤50 keys, a single page suffices.
      const { ok, data } = await jiraJson<{
        issues?: {
          key: string
          fields?: IssueFields
        }[]
      }>(`${base}/rest/api/3/search/jql`, credentials, {
        method: "POST",
        body: JSON.stringify({ jql, fields: fieldsParam, maxResults: SEARCH_KEY_CHUNK }),
      })
      if (ok && Array.isArray(data?.issues)) {
        for (const issue of data.issues) {
          result.set(
            issue.key.trim().toUpperCase(),
            issueFieldsToLancamentoPatch(issue.fields, qtdFieldIds, typeFieldId, qtdErroFieldIds, tagFieldId),
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
  // New API: /search/approximate-count (the old /search is 410 Gone since May 2025).
  try {
    const { ok, data } = await jiraJson<{ count?: number }>(
      `${base}/rest/api/3/search/approximate-count`,
      credentials,
      { method: "POST", body: JSON.stringify({ jql }) },
    )
    if (ok && typeof data?.count === "number") {
      return Math.min(data.count, MAX_BROKEN_TEST_SEARCH_TOTAL)
    }
  } catch {
    // non-fatal
  }
  return 0
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
 * Busca issues do tipo Broken Test criadas pelo accountId (ou displayName) no
 * intervalo e soma o campo "Qtd. Cenários QA" de cada uma.
 *
 * INDEPENDENTE dos worklogs — o QA lança horas na issue-pai ou numa subtarefa
 * [TESTE], não no Broken Test em si. Por isso o cálculo de Cenários com Erro
 * deve buscar as issues de Broken Test diretamente por reporter.
 */
export async function fetchBrokenTestFieldSumByReporter(
  base: string,
  credentials: string,
  accountId: string,
  fromIso: string,
  toIso: string,
  displayName?: string,
): Promise<{ cenariosQASum: number; issueCount: number }> {
  const qtdFieldIds = await resolveQtdCenariosQAFieldIds(base, credentials)
  if (qtdFieldIds.length === 0) return { cenariosQASum: 0, issueCount: 0 }

  // Coleta candidatos de accountId (igual a countReporterIssuesByTypes)
  const candidateIds = new Set<string>()
  if (accountId.trim()) candidateIds.add(accountId.trim())
  if (displayName?.trim()) {
    try {
      const byName = await findJiraAccountIdsByDisplayName(base, credentials, displayName.trim())
      for (const u of byName) candidateIds.add(u.accountId)
    } catch {
      // non-fatal
    }
  }
  if (candidateIds.size === 0) return { cenariosQASum: 0, issueCount: 0 }

  const ids = Array.from(candidateIds)
    .map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(", ")
  const reporterClause = candidateIds.size === 1 ? `reporter = ${ids}` : `reporter in (${ids})`

  // Limite superior: dia seguinte a toIso (igual ao critério de countReporterIssuesByTypes)
  const upperExclusive = (() => {
    const d = new Date(`${toIso}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const jql =
    `${reporterClause} AND ${brokenTestIssuetypeClauseJql()} ` +
    `AND status != "Cancelado" AND created >= "${fromIso}" AND created < "${upperExclusive}"`

  const fieldNames = [...qtdFieldIds, "issuetype"]
  // issueKey → qtdCenariosQA (0 se nulo/não encontrado)
  const seen = new Map<string, number>()

  try {
    let token: string | null = null
    for (;;) {
      const body: Record<string, unknown> = { jql, fields: fieldNames, maxResults: 50 }
      if (token) body.nextPageToken = token

      const { ok, data } = await jiraJson<{
        issues?: { key: string; fields?: IssueFields }[]
        nextPageToken?: string
        isLast?: boolean
      }>(`${base}/rest/api/3/search/jql`, credentials, {
        method: "POST",
        body: JSON.stringify(body),
      })

      if (!ok || !data?.issues) break

      for (const issue of data.issues) {
        const key = issue.key.trim().toUpperCase()
        if (seen.has(key)) continue
        const f = issue.fields ?? {}
        let val: number | null = null
        for (const id of qtdFieldIds) {
          if (f[id] != null) {
            val = parseQtdCenariosQAFieldValue(f[id])
            if (val != null) break
          }
        }
        seen.set(key, val ?? 0)
      }

      token = typeof data.nextPageToken === "string" ? data.nextPageToken : null
      if (data.isLast === true || !token || data.issues.length === 0) break
      if (seen.size >= MAX_BROKEN_TEST_SEARCH_TOTAL) break
    }
  } catch {
    // non-fatal — retorna o que tiver acumulado
  }

  let cenariosQASum = 0
  for (const v of seen.values()) cenariosQASum += v

  return { cenariosQASum, issueCount: seen.size }
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
    qtdCenariosErro:
      next.qtdCenariosErro != null && Number.isFinite(next.qtdCenariosErro)
        ? next.qtdCenariosErro
        : prev?.qtdCenariosErro != null && Number.isFinite(prev.qtdCenariosErro)
          ? prev.qtdCenariosErro
          : null,
    projectName: next.projectName?.trim()
      ? next.projectName.trim()
      : prev?.projectName?.trim()
        ? prev.projectName.trim()
        : null,
    typeField: next.typeField?.trim()
      ? next.typeField.trim()
      : prev?.typeField?.trim()
        ? prev.typeField.trim()
        : null,
    status: next.status?.trim()
      ? next.status.trim()
      : prev?.status?.trim()
        ? prev.status.trim()
        : null,
    tag: next.tag?.trim()
      ? next.tag.trim()
      : prev?.tag?.trim()
        ? prev.tag.trim()
        : null,
    assigneeAccountId: next.assigneeAccountId?.trim()
      ? next.assigneeAccountId.trim()
      : prev?.assigneeAccountId?.trim()
        ? prev.assigneeAccountId.trim()
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
  const [qtdFieldIds, typeFieldId, qtdErroFieldIds, tagFieldId] = await Promise.all([
    resolveQtdCenariosQAFieldIds(base, credentials),
    resolveTypeFieldId(base, credentials),
    resolveQtdCenariosErroFieldIds(base, credentials),
    resolveTagFieldId(base, credentials),
  ])

  const unique = Array.from(new Set(allKeysUppercase.map((k) => k.trim().toUpperCase())))
  const need = unique
    .filter((k) => /^[A-Z][A-Z0-9]*-\d+$/i.test(k))
    .filter((k) => {
      const p = fieldMap.get(k)
      if (!p) return true
      const missMeta = !p.summary?.trim() || !p.priority?.trim()
      const missQtd =
        qtdFieldIds.length > 0 &&
        (p.qtdCenariosQA == null || !Number.isFinite(p.qtdCenariosQA))
      const missErro =
        qtdErroFieldIds.length > 0 &&
        (p.qtdCenariosErro == null || !Number.isFinite(p.qtdCenariosErro))
      return missMeta || missQtd || missErro
    })
    .slice(0, MAX_ISSUE_FIELDS_FALLBACK_GET)

  if (need.length === 0) return

  const fieldNames = ["summary", "issuetype", "priority", "labels", "project", "assignee",
    ...qtdFieldIds, ...qtdErroFieldIds]
  if (typeFieldId) fieldNames.push(typeFieldId)
  if (tagFieldId) fieldNames.push(tagFieldId)
  const fieldsComma = fieldNames.join(",")

  for (let i = 0; i < need.length; i += FALLBACK_GET_CONCURRENCY) {
    const slice = need.slice(i, i + FALLBACK_GET_CONCURRENCY)
    await Promise.all(
      slice.map(async (key) => {
        try {
          const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fieldsComma}`
          const { ok, data } = await jiraJson<{ fields?: IssueFields }>(url, credentials)
          if (!ok || !data?.fields) return
          const patch = issueFieldsToLancamentoPatch(data.fields, qtdFieldIds, typeFieldId, qtdErroFieldIds, tagFieldId)
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

  try {
    const { ok, data } = await jiraJson<{ count?: number }>(
      `${base}/rest/api/3/search/approximate-count`,
      credentials,
      { method: "POST", body: JSON.stringify({ jql }) },
    )
    if (ok && typeof data?.count === "number") {
      return Math.min(data.count, MAX_BROKEN_TEST_SEARCH_TOTAL)
    }
  } catch {
    // non-fatal
  }
  return 0
}

/**
 * Conta issues onde reporter = accountId e issuetype ∈ {Broken Test, Erro Teste, …}
 * criadas dentro do intervalo [fromIso, toIso]. Usa paginação segura.
 * Tipos configuráveis via env JIRA_BROKEN_TEST_ISSUE_TYPES (csv). "Erro Teste" é sempre incluído.
 */
export type ReporterCountDiagnostics = {
  count: number
  /** Tentativas de JQL feitas, em ordem, com status HTTP e contagem retornada. */
  attempts: { jql: string; httpStatus: number; count: number }[]
  /** Lista de accountIds tentados (do email + da busca por nome). */
  accountIdsTried: string[]
}

export async function countReporterIssuesByTypes(
  base: string,
  credentials: string,
  accountId: string,
  fromIso: string,
  toIso: string,
  displayName?: string,
): Promise<ReporterCountDiagnostics> {
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

  // Upper bound: the day after `toIso` so issues created anywhere during that
  // day are included regardless of timezone skew, without leaking into future days.
  const upperExclusive = (() => {
    const d = new Date(`${toIso}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const attempts: ReporterCountDiagnostics["attempts"] = []

  async function runJql(reporterClause: string): Promise<number> {
    const jql = `${reporterClause} AND ${issuetypeClause} AND status != "Cancelado" AND created >= "${fromIso}" AND created < "${upperExclusive}"`
    // New API (post May 2025): /search/approximate-count returns just a count.
    // The legacy /search endpoint returns 410 Gone.
    const { ok, status, data } = await jiraJson<{ count?: number }>(
      `${base}/rest/api/3/search/approximate-count`,
      credentials,
      { method: "POST", body: JSON.stringify({ jql }) },
    )
    const count = ok && typeof data?.count === "number" ? data.count : 0
    const capped = Math.min(count, MAX_BROKEN_TEST_SEARCH_TOTAL)
    attempts.push({ jql, httpStatus: status, count: capped })
    return capped
  }

  // Collect candidate accountIds: from the email lookup + from a name-based
  // Jira user search (to recover the right user when emails are hidden).
  const accountIdsTried: string[] = []
  const candidateIds = new Set<string>()
  if (accountId.trim()) {
    candidateIds.add(accountId.trim())
    accountIdsTried.push(accountId.trim())
  }
  if (displayName?.trim()) {
    const byName = await findJiraAccountIdsByDisplayName(base, credentials, displayName.trim())
    for (const u of byName) {
      if (!candidateIds.has(u.accountId)) {
        candidateIds.add(u.accountId)
        accountIdsTried.push(u.accountId)
      }
    }
  }

  // Single combined query covering all candidate accountIds — the most
  // efficient and unambiguous way to count.
  if (candidateIds.size > 0) {
    const ids = Array.from(candidateIds)
      .map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
      .join(", ")
    const clause = ids.includes(",") ? `reporter in (${ids})` : `reporter = ${ids}`
    const count = await runJql(clause)
    if (count > 0) {
      return { count, attempts, accountIdsTried }
    }
  }

  // Last resort: try reporter = "Display Name" — Jira Cloud JQL accepts this
  // when the name is unique. Matches exactly what the Jira UI filter sends.
  if (displayName?.trim()) {
    const escapedName = `"${displayName.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    const count = await runJql(`reporter = ${escapedName}`)
    return { count, attempts, accountIdsTried }
  }

  return { count: 0, attempts, accountIdsTried }
}

// ── Custom field discovery ────────────────────────────────────────────────────
// Cache the resolved field IDs for the lifetime of the process to avoid
// repeated GET /rest/api/3/field calls on every request.
//
// IMPORTANTE: retornamos ARRAYS porque projetos distintos (ex: AGROPRR vs B1R)
// podem criar campos custom com o mesmo nome mas IDs diferentes. Usar apenas o
// primeiro ID faz com que issues do outro projeto retornem null para o campo.
// Iteramos todos os IDs e usamos o primeiro valor não-nulo encontrado.

function parseEnvFieldIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

/** Override com IDs fixos (vírgula-separados), útil quando o nome no Jira diverge do padrão. */
const QTD_ENV_FIELD_IDS = parseEnvFieldIds(process.env.JIRA_QTD_CENARIOS_QA_FIELD_ID)

let cachedQtdCenariosQAFieldIds: string[] | undefined = undefined

export async function resolveQtdCenariosQAFieldIds(
  base: string,
  credentials: string,
): Promise<string[]> {
  if (QTD_ENV_FIELD_IDS.length > 0) return QTD_ENV_FIELD_IDS
  if (cachedQtdCenariosQAFieldIds !== undefined) return cachedQtdCenariosQAFieldIds

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string; custom?: boolean }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedQtdCenariosQAFieldIds = []
      return []
    }
    const patterns = [
      /qtd\.?\s*cen[aá]rios\s*qa\b/i,
      /\bqta\.?\s*cen[aá]rios\s*qa\b/i,
      /\bcen[aá]rios\s*qa\b/i,
      /\bqa\s*cen[aá]rios\b/i,
    ]
    cachedQtdCenariosQAFieldIds = data
      .filter((f) => f.custom !== false && patterns.some((re) => re.test(f.name)))
      .map((f) => f.id)
  } catch {
    cachedQtdCenariosQAFieldIds = []
  }

  return cachedQtdCenariosQAFieldIds
}

/** @deprecated Use resolveQtdCenariosQAFieldIds — mantido apenas para retrocompatibilidade pontual. */
export async function resolveQtdCenariosQAFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  const ids = await resolveQtdCenariosQAFieldIds(base, credentials)
  return ids[0] ?? null
}

const QTD_ERRO_ENV_FIELD_IDS = parseEnvFieldIds(process.env.JIRA_QTD_CENARIOS_ERRO_FIELD_ID)

let cachedQtdCenariosErroFieldIds: string[] | undefined = undefined

export async function resolveQtdCenariosErroFieldIds(
  base: string,
  credentials: string,
): Promise<string[]> {
  if (QTD_ERRO_ENV_FIELD_IDS.length > 0) return QTD_ERRO_ENV_FIELD_IDS
  if (cachedQtdCenariosErroFieldIds !== undefined) return cachedQtdCenariosErroFieldIds

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string; custom?: boolean }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedQtdCenariosErroFieldIds = []
      return []
    }
    const patterns = [
      /qtd\.?\s*cen[aá]rios\s*com\s*erro\b/i,
      /cen[aá]rios\s*com\s*erro\b/i,
      /qtd\.?\s*cen[aá]rios\s*erro\b/i,
    ]
    cachedQtdCenariosErroFieldIds = data
      .filter((f) => f.custom !== false && patterns.some((re) => re.test(f.name)))
      .map((f) => f.id)
  } catch {
    cachedQtdCenariosErroFieldIds = []
  }

  return cachedQtdCenariosErroFieldIds
}

/** @deprecated Use resolveQtdCenariosErroFieldIds — mantido apenas para retrocompatibilidade pontual. */
export async function resolveQtdCenariosErroFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  const ids = await resolveQtdCenariosErroFieldIds(base, credentials)
  return ids[0] ?? null
}

const TYPE_ENV_FIELD_ID = process.env.JIRA_TYPE_FIELD_ID?.trim()

let cachedTypeFieldId: string | null | undefined = undefined

export async function resolveTypeFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  if (TYPE_ENV_FIELD_ID) return TYPE_ENV_FIELD_ID
  if (cachedTypeFieldId !== undefined) return cachedTypeFieldId

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string; custom?: boolean }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedTypeFieldId = null
      return null
    }
    // Match only custom fields named exactly "Type" (case-insensitive).
    // Avoids colliding with built-in issuetype.
    const found = data.find(
      (f) => f.custom !== false && /^type$/i.test(f.name.trim()),
    )
    cachedTypeFieldId = found?.id ?? null
  } catch {
    cachedTypeFieldId = null
  }

  return cachedTypeFieldId
}

const TAG_ENV_FIELD_ID = process.env.JIRA_TAG_FIELD_ID?.trim()

let cachedTagFieldId: string | null | undefined = undefined

export async function resolveTagFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  if (TAG_ENV_FIELD_ID) return TAG_ENV_FIELD_ID
  if (cachedTagFieldId !== undefined) return cachedTagFieldId

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string; custom?: boolean }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedTagFieldId = null
      return null
    }
    // Match only custom fields named exactly "Tag" (case-insensitive).
    const found = data.find(
      (f) => f.custom !== false && /^tag$/i.test(f.name.trim()),
    )
    cachedTagFieldId = found?.id ?? null
  } catch {
    cachedTagFieldId = null
  }

  return cachedTagFieldId
}

// ── Status transition counting ────────────────────────────────────────────────

/**
 * Conta quantas vezes um conjunto de issues transitou para um status específico
 * consultando a API de changelog do Jira. Tolerante a falhas por issue.
 */
export async function countStatusTransitionsToValue(
  base: string,
  credentials: string,
  issueKeys: string[],
  targetStatus: string,
): Promise<number> {
  const unique = Array.from(new Set(issueKeys.filter((k) => /^[A-Z][A-Z0-9]*-\d+$/i.test(k))))
  if (unique.length === 0) return 0

  const targetLower = targetStatus.trim().toLowerCase()
  let total = 0

  for (let i = 0; i < unique.length; i += FALLBACK_GET_CONCURRENCY) {
    const slice = unique.slice(i, i + FALLBACK_GET_CONCURRENCY)
    const counts = await Promise.all(
      slice.map(async (key): Promise<number> => {
        try {
          let count = 0
          let startAt = 0
          for (;;) {
            const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}/changelog?maxResults=100&startAt=${startAt}`
            const { ok, data } = await jiraJson<{
              values?: { items?: { field?: string; toString?: string }[] }[]
              total?: number
              isLast?: boolean
            }>(url, credentials)
            if (!ok || !data?.values) break
            for (const entry of data.values) {
              for (const item of entry.items ?? []) {
                if (
                  item.field === "status" &&
                  (item.toString ?? "").trim().toLowerCase() === targetLower
                ) {
                  count++
                }
              }
            }
            startAt += data.values.length
            const fetched = startAt
            const total_ = typeof data.total === "number" ? data.total : fetched
            if (data.isLast === true || fetched >= total_ || data.values.length === 0) break
          }
          return count
        } catch {
          return 0
        }
      }),
    )
    total += counts.reduce((a, b) => a + b, 0)
  }

  return total
}

// ── Issue search ──────────────────────────────────────────────────────────────

async function searchIssuesByJql(
  base: string,
  credentials: string,
  jql: string,
  nextPageToken: string | null,
  extraFields: string[],
): Promise<{
  issues: { key: string; fields?: IssueFields }[]
  nextPageToken: string | null
  isLast: boolean
} | null> {
  // New /search/jql endpoint (legacy /search is 410 Gone since May 2025).
  // Cursor pagination via nextPageToken; response no longer carries `total`.
  const searchUrl = `${base}/rest/api/3/search/jql`
  const body: Record<string, unknown> = {
    jql,
    fields: ["summary", "issuetype", "priority", "labels", ...extraFields],
    maxResults: SEARCH_PAGE,
  }
  if (nextPageToken) body.nextPageToken = nextPageToken
  const { ok, data, status } = await jiraJson<{
    issues?: { key: string; fields?: IssueFields }[]
    nextPageToken?: string
    isLast?: boolean
  }>(searchUrl, credentials, {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!ok || !data?.issues) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[jira-worklogs-fetch] search failed", status, data)
    }
    return null
  }
  return {
    issues: data.issues,
    nextPageToken: typeof data.nextPageToken === "string" ? data.nextPageToken : null,
    isLast: data.isLast === true || !data.nextPageToken,
  }
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

  const [qtdFieldIds, typeFieldId, qtdErroFieldIds, tagFieldId] = await Promise.all([
    resolveQtdCenariosQAFieldIds(base, credentials),
    resolveTypeFieldId(base, credentials),
    resolveQtdCenariosErroFieldIds(base, credentials),
    resolveTagFieldId(base, credentials),
  ])
  const extraFields = [
    ...qtdFieldIds,
    ...qtdErroFieldIds,
    ...(typeFieldId ? [typeFieldId] : []),
  ]

  const escaped = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jqlDated = `worklogAuthor = "${escaped}" AND worklogDate >= "${jFrom}" AND worklogDate <= "${jTo}" ORDER BY updated DESC`
  const jqlFallback = `worklogAuthor = "${escaped}" ORDER BY updated DESC`

  const issueKeys: string[] = []
  const issueFieldsMap = new Map<string, IssueFields>()
  let lastBatchWasLast = true

  const runSearch = async (jql: string, capIssues: number) => {
    issueKeys.length = 0
    issueFieldsMap.clear()
    let token: string | null = null
    lastBatchWasLast = true
    do {
      const batch = await searchIssuesByJql(base, credentials, jql, token, extraFields)
      if (!batch) break
      for (const issue of batch.issues) {
        if (issueKeys.length >= capIssues) break
        if (!issueKeys.includes(issue.key)) {
          issueKeys.push(issue.key)
          issueFieldsMap.set(issue.key, issue.fields ?? {})
        }
      }
      token = batch.nextPageToken
      lastBatchWasLast = batch.isLast
      if (issueKeys.length >= capIssues || batch.isLast || !token || batch.issues.length === 0) break
    } while (true)
  }

  await runSearch(jqlDated, MAX_ISSUES)
  if (issueKeys.length === 0) {
    await runSearch(jqlFallback, Math.min(50, MAX_ISSUES))
  }

  const truncatedIssues = !lastBatchWasLast || issueKeys.length >= MAX_ISSUES

  const entries: JiraLancamentoEntry[] = []

  for (const issueKey of issueKeys) {
    if (entries.length >= MAX_WORKLOGS_TOTAL) break
    const fields = issueFieldsMap.get(issueKey) ?? {}
    const patch = issueFieldsToLancamentoPatch(fields, qtdFieldIds, typeFieldId, qtdErroFieldIds, tagFieldId)
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
          typeField: patch.typeField,
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

// ─── Changelog / Retornos ─────────────────────────────────────────────────────

/**
 * For each issue key, counts how many times it transitioned FROM a status
 * containing "approval" BACK TO a status containing "pending" or "in progress".
 * Uses the dedicated GET /rest/api/3/issue/{key}/changelog endpoint (reliable,
 * paginated) instead of search+expand which is inconsistent in Jira Cloud.
 */
export type RetornosResult = { total: number; byAssignee: Record<string, number> }

export async function fetchRetornosForKeys(
  base: string,
  credentials: string,
  keys: string[],
): Promise<Map<string, RetornosResult>> {
  const result = new Map<string, RetornosResult>()
  if (!keys.length) return result

  const CONCURRENCY = 10
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (key) => {
        const { ok, data } = await jiraJson<{
          values?: {
            items: {
              field: string
              from: string | null
              fromString: string | null
              to: string | null
              toString: string | null
            }[]
          }[]
        }>(
          `${base}/rest/api/3/issue/${encodeURIComponent(key)}/changelog?maxResults=200`,
          credentials,
        )
        if (!ok || !data?.values) return

        // Jira returns changelog newest-first; reverse for chronological traversal
        const chronological = [...data.values].reverse()

        let currentAssignee: string | null = null
        let total = 0
        const byAssignee: Record<string, number> = {}

        for (const history of chronological) {
          const assigneeItem = history.items.find((i) => i.field === "assignee")

          // If we haven't established who the initial assignee is yet, use this
          // change's "from" value (which is the accountId of the previous assignee)
          if (assigneeItem && currentAssignee === null) {
            currentAssignee = assigneeItem.from ?? null
          }

          for (const item of history.items) {
            const from = (item.fromString ?? "").toLowerCase()
            const to   = (item.toString  ?? "").toLowerCase()
            if (
              item.field === "status" &&
              from.includes("approval") &&
              (to.includes("pending") || to === "in progress")
            ) {
              total++
              if (currentAssignee) {
                byAssignee[currentAssignee] = (byAssignee[currentAssignee] ?? 0) + 1
              }
            }
          }

          // Update assignee after recording transitions in this entry
          if (assigneeItem) {
            currentAssignee = assigneeItem.to ?? null
          }
        }

        result.set(key.toUpperCase(), { total, byAssignee })
      }),
    )
  }

  return result
}
