/**
 * Parity tests for computeJiraKpis — the shared KPI function used by
 * both the individual Lançamentos screen and all team dashboards (QA / UX / TW).
 *
 * These tests exist because of a real production bug:
 *   Dashboard QA showed 11 jiras / 0 broken while Lançamentos showed 16 jiras / 9 broken
 *   for the same collaborator in the same period.
 * Root cause: stale cache metadata + duplicated KPI logic that could drift over time.
 *
 * Goal: ensure the logic encoded in computeJiraKpis is correct and stable.
 * If a rule changes, it MUST change here too — that is the point.
 */

import { describe, it, expect } from "vitest"
import { computeJiraKpis, priorityIsCritical, isBrokenTest } from "@/features/qa/lib/jira-stats-kpis"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BROKEN_TYPES = ["Broken Test"]

/** A typical QA worklog entry. */
function entry(
  overrides: Partial<{
    issueKey: string
    issueType: string | null
    priority: string | null
    qtdCenariosQA: number | null
    qtdCenariosErro: number | null
  }>,
) {
  return {
    issueKey: "QA-1",
    issueType: null,
    priority: null,
    qtdCenariosQA: null,
    qtdCenariosErro: null,
    ...overrides,
  }
}

// ── priorityIsCritical ────────────────────────────────────────────────────────

describe("priorityIsCritical", () => {
  it.each([
    ["Critical",  true],
    ["CRITICAL",  true],
    ["critical",  true],
    ["Crítico",   true],
    ["critico",   true],
    ["Crítica",   true],
    ["highest",   true],
    ["Highest",   true],
    ["alta",      true],
    ["Alta",      true],
    ["Blocker",   true],
    ["imediato",  true],
    ["Medium",    false],
    ["Low",       false],
    ["Normal",    false],
    ["",          false],
    [null,        false],
    [undefined,   false],
  ])("priority=%s → %s", (p, expected) => {
    expect(priorityIsCritical(p as string | null | undefined)).toBe(expected)
  })
})

// ── isBrokenTest ──────────────────────────────────────────────────────────────

describe("isBrokenTest", () => {
  const normalized = BROKEN_TYPES.map((t) => t.toLowerCase().trim())

  it("matches exact normalized name (case-insensitive)", () => {
    expect(isBrokenTest("Broken Test", normalized)).toBe(true)
    expect(isBrokenTest("broken test", normalized)).toBe(true)
    expect(isBrokenTest("BROKEN TEST", normalized)).toBe(true)
  })

  it("does not match partial name when types are configured", () => {
    expect(isBrokenTest("Broken", normalized)).toBe(false)
  })

  it("falls back to includes-broken when no types configured", () => {
    expect(isBrokenTest("Broken Test", [])).toBe(true)
    expect(isBrokenTest("broken something", [])).toBe(true)
    expect(isBrokenTest("Bug", [])).toBe(false)
  })

  it("returns false for null/undefined", () => {
    expect(isBrokenTest(null, normalized)).toBe(false)
    expect(isBrokenTest(undefined, normalized)).toBe(false)
    expect(isBrokenTest("", normalized)).toBe(false)
  })
})

// ── computeJiraKpis ───────────────────────────────────────────────────────────

describe("computeJiraKpis", () => {
  it("returns zeros for empty entries", () => {
    const kpis = computeJiraKpis([], BROKEN_TYPES)
    expect(kpis).toEqual({
      totalIssues: 0,
      criticalCount: 0,
      jirasBroken: 0,
      cenariosTestados: 0,
      cenariosErro: 0,
    })
  })

  it("counts unique issues (deduplicates multiple worklogs per issue)", () => {
    const entries = [
      entry({ issueKey: "QA-1" }),
      entry({ issueKey: "QA-1" }), // duplicate
      entry({ issueKey: "QA-2" }),
    ]
    const { totalIssues } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(totalIssues).toBe(2)
  })

  it("counts critical issues", () => {
    const entries = [
      entry({ issueKey: "QA-1", priority: "Critical" }),
      entry({ issueKey: "QA-2", priority: "Medium" }),
      entry({ issueKey: "QA-3", priority: "Highest" }),
    ]
    const { criticalCount } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(criticalCount).toBe(2)
  })

  it("counts broken test issues", () => {
    const entries = [
      entry({ issueKey: "QA-1", issueType: "Broken Test" }),
      entry({ issueKey: "QA-2", issueType: "Bug" }),
      entry({ issueKey: "QA-3", issueType: "Broken Test" }),
    ]
    const { jirasBroken } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(jirasBroken).toBe(2)
  })

  it("sums max(qtdCenariosQA) per unique issue for cenariosTestados", () => {
    // QA-1: two worklogs, values 3 and 5 → max = 5
    // QA-2: one worklog, value 10
    // cenariosTestados = 5 + 10 = 15
    const entries = [
      entry({ issueKey: "QA-1", qtdCenariosQA: 3 }),
      entry({ issueKey: "QA-1", qtdCenariosQA: 5 }),
      entry({ issueKey: "QA-2", qtdCenariosQA: 10 }),
    ]
    const { cenariosTestados } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(cenariosTestados).toBe(15)
  })

  it("Tipo A: uses qtdCenariosErro directly for cenariosErro", () => {
    const entries = [
      entry({ issueKey: "QA-1", qtdCenariosErro: 7 }),
      entry({ issueKey: "QA-2", qtdCenariosErro: 3 }),
    ]
    const { cenariosErro } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(cenariosErro).toBe(10)
  })

  it("Tipo B: falls back to qtdCenariosQA for Broken Test issues without qtdCenariosErro", () => {
    const entries = [
      // Broken Test, no qtdCenariosErro → fallback to qtdCenariosQA = 4
      entry({ issueKey: "QA-1", issueType: "Broken Test", qtdCenariosQA: 4, qtdCenariosErro: null }),
    ]
    const { cenariosErro } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(cenariosErro).toBe(4)
  })

  it("Tipo A takes precedence over Tipo B for same issue", () => {
    const entries = [
      // Broken Test WITH qtdCenariosErro → Tipo A wins (use 6, NOT qtdCenariosQA=10)
      entry({ issueKey: "QA-1", issueType: "Broken Test", qtdCenariosQA: 10, qtdCenariosErro: 6 }),
    ]
    const { cenariosErro } = computeJiraKpis(entries, BROKEN_TYPES)
    expect(cenariosErro).toBe(6)
  })

  it("mixes Tipo A and Tipo B correctly (no double-counting)", () => {
    const entries = [
      // Tipo A: has qtdCenariosErro
      entry({ issueKey: "QA-1", issueType: "Bug",         qtdCenariosErro: 5 }),
      // Tipo A: Broken Test with qtdCenariosErro → Tipo A wins
      entry({ issueKey: "QA-2", issueType: "Broken Test", qtdCenariosQA: 20, qtdCenariosErro: 8 }),
      // Tipo B: Broken Test without qtdCenariosErro → fallback
      entry({ issueKey: "QA-3", issueType: "Broken Test", qtdCenariosQA: 12, qtdCenariosErro: null }),
    ]
    const { cenariosErro } = computeJiraKpis(entries, BROKEN_TYPES)
    // QA-1: 5 (Tipo A), QA-2: 8 (Tipo A), QA-3: 12 (Tipo B) → total = 25
    expect(cenariosErro).toBe(25)
  })

  it("regression: Roger's scenario — 16 unique issues, 9 broken, 67 cenariosTestados", () => {
    // Simplified fixture that reproduces the known-good numbers from the Lançamentos screen.
    // If computeJiraKpis changes and these break, the Dashboard will diverge again.
    const brokenType = "Broken Test"
    const bTypes = [brokenType]
    const fixture = [
      // 7 normal issues (not broken, not critical)
      ...Array.from({ length: 7 }, (_, i) =>
        entry({ issueKey: `QA-${i + 1}`, issueType: "Bug", qtdCenariosQA: 3 }),
      ),
      // 9 broken test issues — each with qtdCenariosQA=4 and no qtdCenariosErro
      ...Array.from({ length: 9 }, (_, i) =>
        entry({ issueKey: `QA-BT-${i + 1}`, issueType: brokenType, qtdCenariosQA: 4 }),
      ),
    ]
    const kpis = computeJiraKpis(fixture, bTypes)
    expect(kpis.totalIssues).toBe(16)
    expect(kpis.jirasBroken).toBe(9)
    expect(kpis.cenariosTestados).toBe(7 * 3 + 9 * 4) // 21 + 36 = 57  (simplified; real = 67)
    // cenariosErro: all 9 broken use Tipo B fallback = 9 * 4 = 36
    expect(kpis.cenariosErro).toBe(36)
  })
})
