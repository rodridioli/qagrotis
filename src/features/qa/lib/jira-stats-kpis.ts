/**
 * Shared QA KPI computation for Jira worklogs.
 *
 * **Single source of truth** — used by both the individual Lançamentos screen
 * (IndividualLancamentosSection) and all team dashboards (QA / UX / TW).
 *
 * Rules encoded here must NEVER be duplicated elsewhere.
 * Fixing a rule here fixes it in ALL screens simultaneously.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimal entry shape required for KPI computation.
 * Both LancamentoRow (Lançamentos screen) and JiraEntry (dashboards) satisfy this interface.
 */
export interface KpiEntry {
  issueKey: string
  issueType?: string | null
  priority?: string | null
  /** Maximum value wins when the same issue appears in multiple worklog rows. */
  qtdCenariosQA?: number | null
  qtdCenariosErro?: number | null
}

export interface JiraKpis {
  /** Count of unique issueKeys in the entry list. */
  totalIssues: number
  /** Unique issues with critical/highest/blocker priority. */
  criticalCount: number
  /** Unique Broken Test issues. */
  jirasBroken: number
  /** SUM of max(qtdCenariosQA) per unique issue. */
  cenariosTestados: number
  /**
   * Cenários com Erro — two complementary rules:
   * - Tipo A: SUM of max(qtdCenariosErro) per issue (when field is filled)
   * - Tipo B: fallback — SUM of max(qtdCenariosQA) per Broken Test issue that has NO qtdCenariosErro
   */
  cenariosErro: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePriorityToken(p: string): string {
  return p
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Returns true when the Jira priority is critical / highest / blocker / alta / imediato. */
export function priorityIsCritical(p: string | null | undefined): boolean {
  if (!p?.trim()) return false
  const n = normalizePriorityToken(p)
  return (
    n === "critical" ||
    n === "critico" ||
    n === "highest" ||
    n === "critica" ||
    n === "alta" ||
    n === "blocker" ||
    n === "imediato" ||
    n.includes("critical") ||
    n.includes("critica") ||
    n.includes("critico")
  )
}

/**
 * Returns true when the issue type matches one of the configured Broken Test types.
 *
 * @param issueType – raw issueType string from Jira or cache
 * @param normalizedBrokenTypes – pre-lowercased type names (e.g. `["broken test"]`)
 */
export function isBrokenTest(
  issueType: string | null | undefined,
  normalizedBrokenTypes: string[],
): boolean {
  const t = (issueType ?? "").toLowerCase().trim()
  return normalizedBrokenTypes.length > 0
    ? normalizedBrokenTypes.some((n) => t === n)
    : t.includes("broken")
}

// ── Core KPI function ─────────────────────────────────────────────────────────

/**
 * Computes QA KPIs from a list of worklog entries.
 *
 * Works with any entry type that satisfies {@link KpiEntry}.
 * Multiple worklog rows for the same issue are de-duplicated correctly
 * (max value wins for qtdCenariosQA / qtdCenariosErro).
 *
 * @param entries – worklog rows; may contain multiple rows per issue
 * @param brokenTestTypeNames – raw Jira issue type names for "Broken Test" detection
 *   (e.g. `["Broken Test", "Broken test"]`). Normalised to lowercase internally.
 */
export function computeJiraKpis(
  entries: KpiEntry[],
  brokenTestTypeNames: string[],
): JiraKpis {
  const normalizedBrokenTypes = brokenTestTypeNames.map((t) => t.toLowerCase().trim())

  const issueSet = new Set<string>()
  const criticalIssues = new Set<string>()
  const brokenIssues = new Set<string>()
  // max(qtdCenariosQA) per unique issue
  const cenariosQAByIssue = new Map<string, number>()
  // Tipo A: max(qtdCenariosErro) per unique issue
  const cenariosErroByIssue = new Map<string, number>()
  // Tipo B accumulator: max(qtdCenariosQA) for Broken Test issues (fallback when no Tipo A)
  const brokenTestQAByIssue = new Map<string, number>()

  for (const e of entries) {
    issueSet.add(e.issueKey)
    if (priorityIsCritical(e.priority)) criticalIssues.add(e.issueKey)

    const broken = isBrokenTest(e.issueType, normalizedBrokenTypes)
    if (broken) brokenIssues.add(e.issueKey)

    const qa = e.qtdCenariosQA
    if (qa != null && Number.isFinite(qa) && qa > 0) {
      cenariosQAByIssue.set(e.issueKey, Math.max(cenariosQAByIssue.get(e.issueKey) ?? 0, qa))
    }

    const err = e.qtdCenariosErro
    if (err != null && Number.isFinite(err) && err > 0) {
      cenariosErroByIssue.set(e.issueKey, Math.max(cenariosErroByIssue.get(e.issueKey) ?? 0, err))
    }

    // Tipo B: accumulate qtdCenariosQA for Broken Tests (checked against Tipo A at the end)
    if (broken && qa != null && Number.isFinite(qa) && qa > 0) {
      brokenTestQAByIssue.set(e.issueKey, Math.max(brokenTestQAByIssue.get(e.issueKey) ?? 0, qa))
    }
  }

  const cenariosTestados = Array.from(cenariosQAByIssue.values()).reduce((s, v) => s + v, 0)

  // Tipo A: direct qtdCenariosErro sum
  let cenariosErro = Array.from(cenariosErroByIssue.values()).reduce((s, v) => s + v, 0)
  // Tipo B: add qtdCenariosQA only for Broken Tests that have NO qtdCenariosErro
  for (const [key, v] of brokenTestQAByIssue.entries()) {
    if (!cenariosErroByIssue.has(key)) {
      cenariosErro += v
    }
  }

  return {
    totalIssues: issueSet.size,
    criticalCount: criticalIssues.size,
    jirasBroken: brokenIssues.size,
    cenariosTestados,
    cenariosErro,
  }
}
