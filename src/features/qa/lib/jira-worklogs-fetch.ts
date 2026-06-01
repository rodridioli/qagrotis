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

export async function jiraJson<T>(
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

/**
 * Resolve o ID **real** de um worklog Jira a partir do instante de início.
 *
 * Necessário porque os worklogs listados via Clockwork Pro expõem o ID interno
 * do Clockwork (`cw-…`), que NÃO corresponde ao ID do worklog no Jira. Sem esta
 * resolução, qualquer PUT/DELETE em `/issue/{key}/worklog/{id}` usaria um ID
 * inexistente no Jira e retornaria 404.
 *
 * Casa pelo instante `started` (mesmo epoch, tolerância de 60s) dentro da issue.
 * Quando há mais de um candidato, filtra pelo e-mail do autor (quando fornecido).
 *
 * @returns o ID do worklog no Jira, ou `null` se não encontrado/sem acesso.
 */
export async function findJiraWorklogIdByStarted(
  base: string,
  credentials: string,
  issueKey: string,
  startedIso: string,
  ownerEmail?: string | null,
): Promise<{ worklogId: string | null; httpStatus: number }> {
  const targetMs = new Date(startedIso).getTime()
  if (Number.isNaN(targetMs)) return { worklogId: null, httpStatus: 0 }
  const ownerLower = ownerEmail?.trim().toLowerCase() ?? ""

  let startAt = 0
  let lastStatus = 0
  for (;;) {
    const url = `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?startAt=${startAt}&maxResults=100`
    const { ok, status, data } = await jiraJson<{
      worklogs?: {
        id: string
        started?: string
        author?: { emailAddress?: string }
      }[]
      total?: number
    }>(url, credentials)
    lastStatus = status
    if (!ok || !data?.worklogs) break

    const matches = data.worklogs.filter((w) => {
      if (!w.started) return false
      const ms = new Date(w.started).getTime()
      return !Number.isNaN(ms) && Math.abs(ms - targetMs) <= 60_000
    })
    if (matches.length === 1) return { worklogId: matches[0]!.id, httpStatus: status }
    if (matches.length > 1) {
      if (ownerLower) {
        const byOwner = matches.find(
          (w) => (w.author?.emailAddress ?? "").trim().toLowerCase() === ownerLower,
        )
        if (byOwner) return { worklogId: byOwner.id, httpStatus: status }
      }
      // Ambíguo sem e-mail do autor — usa o primeiro para não bloquear a edição.
      return { worklogId: matches[0]!.id, httpStatus: status }
    }

    startAt += data.worklogs.length
    const total = data.total ?? startAt
    if (startAt >= total || data.worklogs.length === 0) break
  }
  return { worklogId: null, httpStatus: lastStatus }
}

export async function findJiraAccountIdByEmail(
  base: string,
  credentials: string,
  emailNorm: string,
): Promise<{ accountId: string; displayName?: string } | null> {
  // includeInactive=true: Jira Cloud omite contas desativadas por padrão — necessário para ex-membros
  const url = `${base}/rest/api/3/user/search?query=${encodeURIComponent(emailNorm)}&maxResults=20&includeInactive=true`
  const { ok, data } = await jiraJson<{ accountId: string; displayName?: string; emailAddress?: string }[]>(
    url,
    credentials,
  )
  if (!ok || !Array.isArray(data)) return null
  const lower = emailNorm.toLowerCase()
  const exact = data.find((u) => (u.emailAddress ?? "").trim().toLowerCase() === lower)
  if (!exact?.accountId) return null
  return { accountId: exact.accountId, displayName: exact.displayName }
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
  // includeInactive=true: inclui contas desativadas no Jira Cloud (ex-membros)
  const url = `${base}/rest/api/3/user/search?query=${encodeURIComponent(name)}&maxResults=20&includeInactive=true`
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

/**
 * Último recurso para resolver o accountId de um usuário inativo no Jira Cloud:
 * busca issues recentes onde o usuário é reporter ou assignee (via email em JQL),
 * então extrai o accountId dos worklogs dessas issues — o campo `author.accountId`
 * é retornado pelo Jira mesmo para contas completamente desativadas.
 *
 * O casamento é feito em ordem de confiança:
 *   1. author.emailAddress === emailNorm (se visível — não afetado por privacy em worklogs)
 *   2. author.displayName === displayName (case-insensitive)
 *   3. author.displayName contém partes do displayName (fallback fuzzy)
 *   4. Único autor inativo no worklog (author.active === false, quando só há um)
 */
export async function findJiraAccountIdFromRecentIssueWorklogs(
  base: string,
  credentials: string,
  emailNorm: string,
  displayName: string | null,
): Promise<string | null> {
  const email = emailNorm.trim().toLowerCase()
  const name = displayName?.trim().toLowerCase() ?? null

  // Tenta reporter e assignee — ambos aceitam email em JQL no Jira Cloud
  const jqlCandidates = [
    `reporter = "${email.replace(/"/g, '\\"')}" ORDER BY updated DESC`,
    `assignee = "${email.replace(/"/g, '\\"')}" ORDER BY updated DESC`,
  ]

  for (const jql of jqlCandidates) {
    const searchUrl = `${base}/rest/api/3/search/jql`
    const { ok, data } = await jiraJson<{ issues?: { key: string }[] }>(
      searchUrl,
      credentials,
      { method: "POST", body: JSON.stringify({ jql, fields: ["summary"], maxResults: 5 }) },
    )
    if (!ok || !data?.issues?.length) continue

    for (const issue of data.issues.slice(0, 5)) {
      const wlUrl = `${base}/rest/api/3/issue/${encodeURIComponent(issue.key)}/worklog?maxResults=100`
      const { ok: wlOk, data: wlData } = await jiraJson<{
        worklogs?: {
          author?: {
            accountId?: string
            emailAddress?: string
            displayName?: string
            active?: boolean
          }
        }[]
      }>(wlUrl, credentials)

      if (!wlOk || !wlData?.worklogs?.length) continue

      const inactiveAuthors = wlData.worklogs
        .map((w) => w.author)
        .filter((a): a is { accountId: string; emailAddress?: string; displayName?: string; active?: boolean } =>
          typeof a?.accountId === "string" && a.accountId.length > 0,
        )

      for (const author of inactiveAuthors) {
        const authorEmail = (author.emailAddress ?? "").trim().toLowerCase()
        const authorName = (author.displayName ?? "").trim().toLowerCase()

        // Nível 1 — email exato
        if (authorEmail && authorEmail === email) {
          console.info("[jira-worklogs-fetch] accountId extraído de worklog via email para %s → %s", emailNorm, author.accountId)
          return author.accountId
        }
        // Nível 2 — displayName exato
        if (name && authorName && authorName === name) {
          console.info("[jira-worklogs-fetch] accountId extraído de worklog via displayName exato para %s → %s", displayName, author.accountId)
          return author.accountId
        }
        // Nível 3 — displayName fuzzy (nome contém partes)
        if (name && authorName) {
          const parts = name.split(/\s+/).filter((p) => p.length > 2)
          if (parts.length > 0 && parts.every((p) => authorName.includes(p))) {
            console.info("[jira-worklogs-fetch] accountId extraído de worklog via displayName fuzzy para %s → %s", displayName, author.accountId)
            return author.accountId
          }
        }
      }

      // Nível 4 — único autor inativo na issue (quando não há ambiguidade)
      const inactiveOnly = inactiveAuthors.filter((a) => a.active === false)
      if (inactiveOnly.length === 1) {
        console.info("[jira-worklogs-fetch] accountId extraído de worklog (único autor inativo) para %s → %s", emailNorm, inactiveOnly[0]!.accountId)
        return inactiveOnly[0]!.accountId
      }
    }
  }
  return null
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

  // Coleta candidatos de accountId. A busca por nome é fallback exclusivo para
  // quando o accountId não está disponível (e-mail oculto por privacidade no Jira).
  // Misturar IDs de outros usuários com nome similar inflaria a contagem.
  const candidateIds = new Set<string>()
  if (accountId.trim()) {
    candidateIds.add(accountId.trim())
  } else if (displayName?.trim()) {
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

  // Collect candidate accountIds. Name-based search is a fallback exclusively for
  // when accountId is unavailable (email hidden by Jira Cloud privacy settings).
  // Adding IDs from other users with similar names would inflate the count.
  const accountIdsTried: string[] = []
  const candidateIds = new Set<string>()
  if (accountId.trim()) {
    candidateIds.add(accountId.trim())
    accountIdsTried.push(accountId.trim())
  } else if (displayName?.trim()) {
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

const SOLICITANTE_ENV_FIELD_ID = process.env.JIRA_SOLICITANTE_FIELD_ID?.trim()

let cachedSolicitanteFieldId: string | null | undefined = undefined

export async function resolveSolicitanteFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  if (SOLICITANTE_ENV_FIELD_ID) return SOLICITANTE_ENV_FIELD_ID
  if (cachedSolicitanteFieldId !== undefined) return cachedSolicitanteFieldId

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string; custom?: boolean }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedSolicitanteFieldId = null
      return null
    }
    const found = data.find(
      (f) => f.custom !== false && /^(solicitante|requester)$/i.test(f.name.trim()),
    )
    cachedSolicitanteFieldId = found?.id ?? null
  } catch {
    cachedSolicitanteFieldId = null
  }

  return cachedSolicitanteFieldId
}

const DEADLINE_ENV_FIELD_ID = process.env.JIRA_DEADLINE_FIELD_ID?.trim()

let cachedDeadlineFieldId: string | null | undefined = undefined

export async function resolveDeadlineFieldId(
  base: string,
  credentials: string,
): Promise<string | null> {
  if (DEADLINE_ENV_FIELD_ID) return DEADLINE_ENV_FIELD_ID
  if (cachedDeadlineFieldId !== undefined) return cachedDeadlineFieldId

  try {
    const { ok, data } = await jiraJson<{ id: string; name: string; custom?: boolean }[]>(
      `${base}/rest/api/3/field`,
      credentials,
    )
    if (!ok || !Array.isArray(data)) {
      cachedDeadlineFieldId = null
      return null
    }
    const found = data.find(
      (f) => f.custom !== false && /^deadline$/i.test(f.name.trim()),
    )
    cachedDeadlineFieldId = found?.id ?? null
  } catch {
    cachedDeadlineFieldId = null
  }

  return cachedDeadlineFieldId
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
 * containing "approval" BACK TO a "work" status (to do, doing, in progress,
 * pending, or any equivalent). Uses GET /rest/api/3/issue/{key}/changelog.
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
              (to.includes("pending") || to.includes("in progress") || to === "to do" || to === "doing")
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

// ── Kanban: issues com status "UX" por projeto ───────────────────────────────

export type KanbanIssue = {
  key: string
  summary: string
  status: string
  statusCategoryColor: string
  assigneeAccountId: string | null
  assigneeDisplayName: string | null
  assigneeAvatarUrl: string | null
  reporterDisplayName: string | null
  priority: string | null
  priorityIconUrl: string | null
  issueTypeIconUrl: string | null
  projectKey: string
  projectName: string
  parentKey: string | null
  parentSummary: string | null
  dueDate: string | null  // YYYY-MM-DD or null
}

const KANBAN_PROJECTS = [
  "Plataforma Agro - REC",
  "Plataforma Agro - UBA",
  "Plataforma Agro - SEM",
  "Plataforma Agro - ARM",
  "UX",
] as const

export const KANBAN_PROJECT_NAMES: readonly string[] = KANBAN_PROJECTS

const KANBAN_MAX_ISSUES = 300

export async function fetchKanbanSubtasks(
  base: string,
  credentials: string,
): Promise<KanbanIssue[]> {
  const projectList = KANBAN_PROJECTS.map((p) => `"${p}"`).join(", ")
  const nonUxProjectList = KANBAN_PROJECTS.filter((p) => p !== "UX")
    .map((p) => `"${p}"`)
    .join(", ")
  const jql =
    `((status = "UX" AND project in (${projectList})) OR (issuetype = "UX" AND project in (${nonUxProjectList}))) AND issueType not in subTaskIssueTypes() ORDER BY project ASC, updated DESC`

  const issues: KanbanIssue[] = []
  let nextPageToken: string | null = null

  while (issues.length < KANBAN_MAX_ISSUES) {
    const page = await searchIssuesByJql(base, credentials, jql, nextPageToken, [
      "status",
      "assignee",
      "reporter",
      "priority",
      "project",
      "parent",
      "duedate",
    ])
    if (!page) break

    for (const issue of page.issues) {
      const f = issue.fields as Record<string, unknown> | undefined

      const statusObj = f?.status as { name?: string; statusCategory?: { colorName?: string } } | null
      const assigneeObj = f?.assignee as { accountId?: string; displayName?: string; avatarUrls?: Record<string, string> } | null
      const reporterObj = f?.reporter as { displayName?: string } | null
      const priorityObj = f?.priority as { name?: string; iconUrl?: string } | null
      const issueTypeObj = f?.issuetype as { name?: string; iconUrl?: string } | null
      const projectObj = f?.project as { key?: string; name?: string } | null
      const parentObj = f?.parent as { key?: string; fields?: { summary?: string } } | null

      issues.push({
        key: issue.key,
        summary: (typeof f?.summary === "string" ? f.summary.trim() : "") || "",
        status: statusObj?.name ?? "",
        statusCategoryColor: statusObj?.statusCategory?.colorName ?? "blue-grey",
        assigneeAccountId: assigneeObj?.accountId ?? null,
        assigneeDisplayName: assigneeObj?.displayName ?? null,
        assigneeAvatarUrl: assigneeObj?.avatarUrls?.["48x48"] ?? null,
        reporterDisplayName: reporterObj?.displayName ?? null,
        priority: priorityObj?.name ?? null,
        priorityIconUrl: priorityObj?.iconUrl ?? null,
        issueTypeIconUrl: issueTypeObj?.iconUrl ?? null,
        projectKey: projectObj?.key ?? issue.key.split("-")[0] ?? "",
        projectName: projectObj?.name ?? "",
        parentKey: parentObj?.key ?? null,
        parentSummary: parentObj?.fields?.summary ?? null,
        dueDate: typeof f?.duedate === "string" ? f.duedate : null,
      })
    }

    if (page.isLast) break
    nextPageToken = page.nextPageToken
  }

  return issues
}

// ── UX Tarefas helpers ───────────────────────────────────────────────────────

/**
 * Extrai o nome do solicitante de um campo Jira que pode ser:
 * - string simples: "Carol"
 * - user-picker: { displayName: "Carol", ... }
 * - option: { value: "Carol" } ou { name: "Carol" }
 */
function parseSolicitanteField(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === "string") return raw.trim() || null
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    const name =
      (typeof o.displayName === "string" ? o.displayName : null) ??
      (typeof o.name === "string" ? o.name : null) ??
      (typeof o.value === "string" ? o.value : null)
    return name?.trim() || null
  }
  return null
}

// ── UX Tarefas (Open / Backlog / Priority / Pending UX from project UX) ──────

export type UxTarefa = {
  key: string
  summary: string
  status: string
  priority: string | null
  priorityIconUrl: string | null
  reporterDisplayName: string | null
  solicitanteDisplayName: string | null
  dueDate: string | null
  deadline: string | null
  tag: string | null
}

// "Pending UX" is included so assigned tarefas are still returned when page re-loads.
// The client filters them into the correct column (Tarefas vs member) based on DB assignments.
const UX_TAREFAS_STATUSES = ["Open", "Backlog", "Priority", "Pending UX"]
const UX_TAREFAS_MAX = 300

export async function fetchUxTarefas(
  base: string,
  credentials: string,
): Promise<UxTarefa[]> {
  const [tagFieldId, solicitanteFieldId, deadlineFieldId] = await Promise.all([
    resolveTagFieldId(base, credentials),
    resolveSolicitanteFieldId(base, credentials),
    resolveDeadlineFieldId(base, credentials),
  ])
  const statusList = UX_TAREFAS_STATUSES.map((s) => `"${s}"`).join(", ")
  const jql = `project = "UX" AND status in (${statusList}) ORDER BY priority ASC, updated DESC`

  const extraFields: string[] = [
    "status",
    "priority",
    "reporter",
    "duedate",
    ...(tagFieldId ? [tagFieldId] : []),
    ...(solicitanteFieldId ? [solicitanteFieldId] : []),
    ...(deadlineFieldId ? [deadlineFieldId] : []),
  ]

  const tarefas: UxTarefa[] = []
  let nextPageToken: string | null = null

  while (tarefas.length < UX_TAREFAS_MAX) {
    const page = await searchIssuesByJql(base, credentials, jql, nextPageToken, extraFields)
    if (!page) break

    for (const issue of page.issues) {
      const f = issue.fields as Record<string, unknown> | undefined
      const statusObj = f?.status as { name?: string } | null
      const priorityObj = f?.priority as { name?: string; iconUrl?: string } | null
      const reporterObj = f?.reporter as { displayName?: string } | null
      const tagRaw = tagFieldId ? f?.[tagFieldId] : undefined
      const solicitanteRaw = solicitanteFieldId ? f?.[solicitanteFieldId] : undefined
      const deadlineRaw = deadlineFieldId ? f?.[deadlineFieldId] : undefined

      tarefas.push({
        key: issue.key,
        summary: (typeof f?.summary === "string" ? f.summary.trim() : "") || "",
        status: statusObj?.name ?? "",
        priority: priorityObj?.name ?? null,
        priorityIconUrl: priorityObj?.iconUrl ?? null,
        reporterDisplayName: reporterObj?.displayName ?? null,
        solicitanteDisplayName: parseSolicitanteField(solicitanteRaw),
        dueDate: typeof f?.duedate === "string" ? f.duedate : null,
        deadline: typeof deadlineRaw === "string" ? deadlineRaw : null,
        tag: parseTypeFieldValue(tagRaw),
      })
    }

    if (page.isLast) break
    nextPageToken = page.nextPageToken
  }

  return tarefas
}

// ── Approval issues by tag (live JQL query, no cache) ─────────────────────────

export interface ApprovalIssueEntry {
  tag: string
  assigneeAccountId: string | null
}

/**
 * Queries Jira directly for issues in the given project with status = "Approval".
 * Returns one entry per issue with tag + assignee accountId so the client can
 * filter by selected member without a re-fetch.
 *
 * @param jqlProject - Jira project name to scope the query, e.g. "UX" or "Documentação Técnica"
 */
export async function fetchApprovalIssuesByTag(
  base: string,
  credentials: string,
  jqlProject = "UX",
): Promise<ApprovalIssueEntry[]> {
  const tagFieldId = await resolveTagFieldId(base, credentials)
  const extraFields: string[] = ["status", "assignee", ...(tagFieldId ? [tagFieldId] : [])]

  const issues: ApprovalIssueEntry[] = []
  let nextPageToken: string | null = null

  const jql = `project in ("${jqlProject}") AND status in (Approval) ORDER BY updated DESC`

  for (;;) {
    const page = await searchIssuesByJql(
      base,
      credentials,
      jql,
      nextPageToken,
      extraFields,
    )
    if (!page) break
    for (const issue of page.issues) {
      const f = issue.fields as Record<string, unknown> | undefined
      const raw = tagFieldId ? f?.[tagFieldId] : undefined
      const tag = parseTypeFieldValue(raw) ?? "Sem tag"
      const assignee = f?.assignee as { accountId?: string } | null | undefined
      const assigneeAccountId = typeof assignee?.accountId === "string" ? assignee.accountId : null
      issues.push({ tag, assigneeAccountId })
    }
    if (page.isLast) break
    nextPageToken = page.nextPageToken
  }

  return issues
}

// ── Kanban utilities ──────────────────────────────────────────────────────────

/**
 * Executes a named Jira status transition on an issue.
 *
 * Matching order (stops at first hit):
 *   1. Exact match on transition name (case-insensitive)
 *   2. Substring match on transition name
 *   3. Exact match on target status name (to.name) — handles workflows where
 *      the transition name differs from the target status (e.g., UX project)
 *   4. Substring match on target status name
 *
 * The `to.name` fallbacks are essential for projects (like UX) whose workflow
 * uses custom transition names (e.g. "Em Aprovação") that do not literally
 * contain the target status string (e.g. "Aprovação").
 */
export async function transitionIssueToStatus(
  base: string,
  credentials: string,
  issueKey: string,
  targetStatusName: string,
): Promise<{ ok: boolean; error?: string }> {
  const transRes = await jiraJson<{
    transitions: { id: string; name: string; to?: { name?: string } }[]
  }>(
    `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    credentials,
  )
  if (!transRes.ok || !transRes.data?.transitions) {
    return { ok: false, error: "Erro ao buscar transições do Jira." }
  }

  const lower = targetStatusName.trim().toLowerCase()
  const transitions = transRes.data.transitions

  // 1 & 2 — match by transition name (original behaviour)
  const exactMatch    = transitions.find((t) => t.name.trim().toLowerCase() === lower)
  const fuzzyMatch    = transitions.find((t) => t.name.trim().toLowerCase().includes(lower))
  // 3 & 4 — match by target status name (to.name); covers UX and other projects
  //          whose workflow names the transition differently from the status
  const byStatusExact = transitions.find((t) => (t.to?.name ?? "").trim().toLowerCase() === lower)
  const byStatusFuzzy = transitions.find((t) => (t.to?.name ?? "").trim().toLowerCase().includes(lower))

  const transition = exactMatch ?? fuzzyMatch ?? byStatusExact ?? byStatusFuzzy

  if (!transition) {
    const available = transitions
      .map((t) => `"${t.name}"${t.to?.name ? `→"${t.to.name}"` : ""}`)
      .join(", ")
    console.warn(
      `[jira] transitionIssueToStatus: nenhuma transição encontrada para '${targetStatusName}' em ${issueKey}. ` +
      `Disponíveis: ${available || "(nenhuma)"}`,
    )
    return { ok: false, error: `Transição '${targetStatusName}' não encontrada no workflow.` }
  }

  if (byStatusExact === transition || byStatusFuzzy === transition) {
    console.info(
      `[jira] transitionIssueToStatus: '${targetStatusName}' casou pelo status-destino ` +
      `(transition.name="${transition.name}", to.name="${transition.to?.name}") em ${issueKey}`,
    )
  }

  const res = await jiraJson(
    `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    credentials,
    { method: "POST", body: JSON.stringify({ transition: { id: transition.id } }) },
  )
  if (!res.ok) return { ok: false, error: "Erro ao executar transição no Jira." }
  return { ok: true }
}

/** Posts an ADF comment to a Jira issue. */
export async function postJiraComment(
  base: string,
  credentials: string,
  issueKey: string,
  body: object,
): Promise<{ ok: boolean; error?: string }> {
  const res = await jiraJson(
    `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
    credentials,
    { method: "POST", body: JSON.stringify({ body }) },
  )
  if (!res.ok) return { ok: false, error: "Erro ao postar comentário no Jira." }
  return { ok: true }
}

/**
 * Builds an ADF paragraph with an optional @mention followed by `text`.
 * The `text` argument is appended directly after the mention node — include
 * any leading punctuation/space you need (e.g. `", continua…"` or `" continua…"`).
 */
export function buildAdfComment(
  text: string,
  mention?: { accountId: string; displayName: string },
): object {
  const content: object[] = []
  if (mention) {
    content.push({
      type: "mention",
      attrs: { id: mention.accountId, text: `@${mention.displayName}`, accessLevel: "APPLICATION" },
    })
  }
  content.push({ type: "text", text })
  return { version: 1, type: "doc", content: [{ type: "paragraph", content }] }
}

/**
 * Builds an ADF paragraph where the @mention appears **in the middle** of the sentence:
 * `before` + @mention + `after`.
 *
 * Example: `"Tarefa aprovada por "` + @Name + `" e concluída junto ao time de UX."`
 */
export function buildAdfCommentInline(
  before: string,
  mention: { accountId: string; displayName: string },
  after: string,
): object {
  const content: object[] = [
    { type: "text", text: before },
    {
      type: "mention",
      attrs: { id: mention.accountId, text: `@${mention.displayName}`, accessLevel: "APPLICATION" },
    },
    { type: "text", text: after },
  ]
  return { version: 1, type: "doc", content: [{ type: "paragraph", content }] }
}

/** Searches Jira users by display name or email (for @mention autocomplete). */
export async function searchJiraUsersForMention(
  base: string,
  credentials: string,
  query: string,
): Promise<{ accountId: string; displayName: string; avatarUrl: string | null }[]> {
  if (!query.trim()) return []
  const url = `${base}/rest/api/3/user/search?query=${encodeURIComponent(query.trim())}&maxResults=10`
  const { ok, data } = await jiraJson<
    { accountId: string; displayName?: string; avatarUrls?: Record<string, string> }[]
  >(url, credentials)
  if (!ok || !Array.isArray(data)) return []
  return data
    .filter((u): u is typeof u & { accountId: string } => typeof u.accountId === "string" && u.accountId.length > 0)
    .map((u) => ({
      accountId: u.accountId,
      displayName: u.displayName ?? u.accountId,
      avatarUrl: u.avatarUrls?.["48x48"] ?? null,
    }))
}

/** Fetches full issue details for an array of issue keys. Returns a map: uppercase key → data. */
export type KanbanIssueDetail = {
  key: string
  summary: string
  jiraStatus: string
  priority: string | null
  priorityIconUrl: string | null
  dueDate: string | null
  reporterDisplayName: string | null
  reporterAccountId: string | null
  projectName: string
  projectKey: string
}

export async function fetchIssueDetailsByKeys(
  base: string,
  credentials: string,
  keys: string[],
): Promise<Map<string, KanbanIssueDetail>> {
  const result = new Map<string, KanbanIssueDetail>()
  if (keys.length === 0) return result

  const unique = [...new Set(keys.map((k) => k.trim().toUpperCase()))]
  const CHUNK = 50
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const quoted = chunk.map((k) => `"${k.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(", ")
    try {
      const { ok, data } = await jiraJson<{
        issues?: {
          key: string
          fields?: {
            summary?: unknown
            status?: { name?: string }
            priority?: { name?: string; iconUrl?: string }
            duedate?: string
            reporter?: { displayName?: string; accountId?: string }
            project?: { key?: string; name?: string }
          }
        }[]
      }>(`${base}/rest/api/3/search/jql`, credentials, {
        method: "POST",
        body: JSON.stringify({
          jql: `key in (${quoted})`,
          fields: ["summary", "status", "priority", "duedate", "reporter", "project"],
          maxResults: CHUNK,
        }),
      })
      if (ok && Array.isArray(data?.issues)) {
        for (const issue of data.issues) {
          const f = issue.fields ?? {}
          result.set(issue.key.toUpperCase(), {
            key: issue.key,
            summary: typeof f.summary === "string" ? f.summary.trim() : "",
            jiraStatus: f.status?.name ?? "",
            priority: f.priority?.name ?? null,
            priorityIconUrl: f.priority?.iconUrl ?? null,
            dueDate: typeof f.duedate === "string" ? f.duedate : null,
            reporterDisplayName: f.reporter?.displayName ?? null,
            reporterAccountId: f.reporter?.accountId ?? null,
            projectName: f.project?.name ?? "",
            projectKey: f.project?.key ?? issue.key.split("-")[0] ?? "",
          })
        }
      }
    } catch {
      // non-fatal
    }
  }
  return result
}

/**
 * Fetches full UxTarefa data (including tag, solicitante, deadline) for an
 * explicit list of issue keys. Used to supplement JQL results with issues that
 * are assigned in the DB but missing from the standard status-filtered query.
 */
export async function fetchUxTarefasByKeys(
  base: string,
  credentials: string,
  keys: string[],
): Promise<UxTarefa[]> {
  if (keys.length === 0) return []

  const [tagFieldId, solicitanteFieldId, deadlineFieldId] = await Promise.all([
    resolveTagFieldId(base, credentials),
    resolveSolicitanteFieldId(base, credentials),
    resolveDeadlineFieldId(base, credentials),
  ])

  const unique = [...new Set(keys.map((k) => k.trim().toUpperCase()))]
  const extraFields: string[] = [
    "status", "priority", "reporter", "duedate",
    ...(tagFieldId ? [tagFieldId] : []),
    ...(solicitanteFieldId ? [solicitanteFieldId] : []),
    ...(deadlineFieldId ? [deadlineFieldId] : []),
  ]

  const tarefas: UxTarefa[] = []
  const CHUNK = 50

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const quoted = chunk.map((k) => `"${k.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(", ")
    const jql = `key in (${quoted})`
    try {
      const page = await searchIssuesByJql(base, credentials, jql, null, extraFields)
      if (!page) continue
      for (const issue of page.issues) {
        const f = issue.fields as Record<string, unknown> | undefined
        const statusObj = f?.status as { name?: string } | null
        const priorityObj = f?.priority as { name?: string; iconUrl?: string } | null
        const reporterObj = f?.reporter as { displayName?: string } | null
        const tagRaw = tagFieldId ? f?.[tagFieldId] : undefined
        const solicitanteRaw = solicitanteFieldId ? f?.[solicitanteFieldId] : undefined
        const deadlineRaw = deadlineFieldId ? f?.[deadlineFieldId] : undefined
        tarefas.push({
          key: issue.key,
          summary: (typeof f?.summary === "string" ? f.summary.trim() : "") || "",
          status: statusObj?.name ?? "",
          priority: priorityObj?.name ?? null,
          priorityIconUrl: priorityObj?.iconUrl ?? null,
          reporterDisplayName: reporterObj?.displayName ?? null,
          solicitanteDisplayName: parseSolicitanteField(solicitanteRaw),
          dueDate: typeof f?.duedate === "string" ? f.duedate : null,
          deadline: typeof deadlineRaw === "string" ? deadlineRaw : null,
          tag: parseTypeFieldValue(tagRaw),
        })
      }
    } catch {
      // non-fatal
    }
  }

  return tarefas
}

/**
 * Fetches UX project issues assigned to a specific Jira accountId (any status).
 * Returns UxTarefa-compatible objects with current Jira status.
 */
export async function fetchUxTarefasForUser(
  base: string,
  credentials: string,
  accountId: string,
): Promise<UxTarefa[]> {
  const [tagFieldId, solicitanteFieldId, deadlineFieldId] = await Promise.all([
    resolveTagFieldId(base, credentials),
    resolveSolicitanteFieldId(base, credentials),
    resolveDeadlineFieldId(base, credentials),
  ])

  const escaped = accountId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const jql = `project = "UX" AND assignee = "${escaped}" ORDER BY priority ASC, updated DESC`
  const extraFields: string[] = [
    "status", "priority", "reporter", "duedate",
    ...(tagFieldId ? [tagFieldId] : []),
    ...(solicitanteFieldId ? [solicitanteFieldId] : []),
    ...(deadlineFieldId ? [deadlineFieldId] : []),
  ]

  const tarefas: UxTarefa[] = []
  let nextPageToken: string | null = null

  while (tarefas.length < UX_TAREFAS_MAX) {
    const page = await searchIssuesByJql(base, credentials, jql, nextPageToken, extraFields)
    if (!page) break
    for (const issue of page.issues) {
      const f = issue.fields as Record<string, unknown> | undefined
      const statusObj = f?.status as { name?: string } | null
      const priorityObj = f?.priority as { name?: string; iconUrl?: string } | null
      const reporterObj = f?.reporter as { displayName?: string } | null
      const tagRaw = tagFieldId ? f?.[tagFieldId] : undefined
      const solicitanteRaw = solicitanteFieldId ? f?.[solicitanteFieldId] : undefined
      const deadlineRaw = deadlineFieldId ? f?.[deadlineFieldId] : undefined
      tarefas.push({
        key: issue.key,
        summary: (typeof f?.summary === "string" ? f.summary.trim() : "") || "",
        status: statusObj?.name ?? "",
        priority: priorityObj?.name ?? null,
        priorityIconUrl: priorityObj?.iconUrl ?? null,
        reporterDisplayName: reporterObj?.displayName ?? null,
        solicitanteDisplayName: parseSolicitanteField(solicitanteRaw),
        dueDate: typeof f?.duedate === "string" ? f.duedate : null,
        deadline: typeof deadlineRaw === "string" ? deadlineRaw : null,
        tag: parseTypeFieldValue(tagRaw),
      })
    }
    if (page.isLast) break
    nextPageToken = page.nextPageToken
  }
  return tarefas
}

// ── Jira issue creation ────────────────────────────────────────────────────────

/**
 * Creates a new Jira issue and returns its key.
 * `fields` must follow the Jira REST API v3 create-issue schema.
 */
export async function createJiraIssue(
  base: string,
  credentials: string,
  fields: Record<string, unknown>,
): Promise<{ ok: boolean; key?: string; error?: string }> {
  const { ok, data, text } = await jiraJson<{ id: string; key: string }>(
    `${base}/rest/api/3/issue`,
    credentials,
    { method: "POST", body: JSON.stringify({ fields }) },
  )
  if (!ok || !data?.key) {
    return { ok: false, error: `Jira recusou a criação: ${text.slice(0, 300)}` }
  }
  return { ok: true, key: data.key }
}

/**
 * Uploads one or more files as attachments to an existing Jira issue.
 * Each file is uploaded individually; stops and reports on first failure.
 *
 * Note: Content-Type is intentionally omitted so the browser/runtime sets
 * the multipart boundary automatically. The Jira token header is required.
 */
export async function uploadJiraAttachments(
  base: string,
  credentials: string,
  issueKey: string,
  files: File[],
): Promise<{ ok: boolean; error?: string }> {
  for (const file of files) {
    // Build the file blob from the File object. In some server runtimes (Next.js
    // App Router / undici) the object is a Blob-like, not a true File. Reading the
    // bytes explicitly guarantees the binary data is present in the outbound body.
    let fileData: Blob
    try {
      const bytes = await file.arrayBuffer()
      fileData = new Blob([bytes], { type: file.type || "application/octet-stream" })
    } catch {
      return { ok: false, error: `Não foi possível ler o arquivo "${file.name}".` }
    }

    const body = new FormData()
    body.append("file", fileData, file.name)

    let res: Response | null = null
    try {
      res = await fetch(`${base}/rest/api/3/issue/${issueKey}/attachments`, {
        method: "POST",
        headers: {
          Authorization:       `Basic ${credentials}`,
          "X-Atlassian-Token": "no-check",
          Accept:              "application/json",
          // Content-Type must NOT be set — the runtime adds the multipart boundary
        },
        body,
      })
    } catch (err) {
      console.error("[jira-upload] fetch error:", err)
      return { ok: false, error: `Erro de rede ao enviar o anexo "${file.name}".` }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[jira-upload] Jira rejected attachment:", res.status, text.slice(0, 200))
      return { ok: false, error: `Jira recusou o anexo "${file.name}" (${res.status}).` }
    }
  }
  return { ok: true }
}
