import { describe, it, expect } from "vitest"
import {
  isoToDateOnly,
  countUniqueByTypes,
  topProjectsByIssueCount,
} from "@/features/equipe/lib/equipe-performance-utils"
import type { JiraLancamentoEntry } from "@/features/qa/lib/jira-worklogs-fetch"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<JiraLancamentoEntry>): JiraLancamentoEntry {
  return {
    id: "w1",
    issueKey: "UX-1",
    projectKey: "UX",
    projectName: "Projeto UX",
    summary: null,
    issueType: null,
    priority: null,
    labels: [],
    typeField: null,
    started: "2026-05-01T10:00:00.000Z",
    timeSpentSeconds: 3600,
    hours: 1,
    isLongSession: false,
    comment: null,
    ...overrides,
  }
}

// ── isoToDateOnly ─────────────────────────────────────────────────────────────

describe("isoToDateOnly", () => {
  it("extrai YYYY-MM-DD de ISO com hora", () => {
    expect(isoToDateOnly("2026-05-01T03:00:00.000Z")).toBe("2026-05-01")
  })

  it("retorna string já no formato YYYY-MM-DD sem alteração", () => {
    expect(isoToDateOnly("2026-05-01")).toBe("2026-05-01")
  })

  it("funciona com fim de mês", () => {
    expect(isoToDateOnly("2026-01-31T23:59:59.999Z")).toBe("2026-01-31")
  })
})

// ── countUniqueByTypes ────────────────────────────────────────────────────────

describe("countUniqueByTypes", () => {
  it("CA-01: conta New + Redesign sem duplicatas de issueKey", () => {
    const entries = [
      makeEntry({ issueKey: "UX-1", typeField: "New" }),
      makeEntry({ issueKey: "UX-1", typeField: "New", id: "w2" }), // mesmo issueKey, segundo worklog
      makeEntry({ issueKey: "UX-2", typeField: "Redesign" }),
    ]
    expect(countUniqueByTypes(entries, "new", "redesign")).toBe(2)
  })

  it("CA-02: soma Improvement + Adjustment/Return", () => {
    const entries = [
      makeEntry({ issueKey: "UX-10", typeField: "Improvement" }),
      makeEntry({ issueKey: "UX-11", typeField: "Adjustment/Return" }),
      makeEntry({ issueKey: "UX-12", typeField: "Research" }), // não deve contar
    ]
    expect(countUniqueByTypes(entries, "improvement", "adjustment/return")).toBe(2)
  })

  it("é case-insensitive no typeField", () => {
    const entries = [
      makeEntry({ issueKey: "UX-20", typeField: "NEW" }),
      makeEntry({ issueKey: "UX-21", typeField: "new" }),
      makeEntry({ issueKey: "UX-22", typeField: "New" }),
    ]
    expect(countUniqueByTypes(entries, "new")).toBe(3)
  })

  it("retorna 0 quando nenhum entry bate", () => {
    const entries = [makeEntry({ issueKey: "UX-1", typeField: "Research" })]
    expect(countUniqueByTypes(entries, "usability")).toBe(0)
  })

  it("retorna 0 para lista vazia", () => {
    expect(countUniqueByTypes([], "new", "redesign")).toBe(0)
  })

  it("ignora entries com typeField null", () => {
    const entries = [makeEntry({ issueKey: "UX-1", typeField: null })]
    expect(countUniqueByTypes(entries, "new")).toBe(0)
  })

  it("deduplica por issueKey em maiúsculas (case-insensitive na chave)", () => {
    const entries = [
      makeEntry({ issueKey: "ux-1", typeField: "New" }),
      makeEntry({ issueKey: "UX-1", typeField: "New", id: "w2" }),
    ]
    expect(countUniqueByTypes(entries, "new")).toBe(1)
  })

  it("conta issues com múltiplos types quando perfil TW", () => {
    const entries = [
      makeEntry({ issueKey: "TW-1", typeField: "New Documentation" }),
      makeEntry({ issueKey: "TW-2", typeField: "Documentation Review" }),
      makeEntry({ issueKey: "TW-3", typeField: "Others" }),
      makeEntry({ issueKey: "TW-4", typeField: "Others" }),
    ]
    expect(countUniqueByTypes(entries, "new documentation")).toBe(1)
    expect(countUniqueByTypes(entries, "documentation review")).toBe(1)
    expect(countUniqueByTypes(entries, "others")).toBe(2)
  })
})

// ── topProjectsByIssueCount ───────────────────────────────────────────────────

describe("topProjectsByIssueCount", () => {
  it("CA-04: retorna no máximo 3 projetos, ordenados decrescente", () => {
    const entries = [
      makeEntry({ issueKey: "A-1", projectName: "Alpha", projectKey: "A" }),
      makeEntry({ issueKey: "A-2", projectName: "Alpha", projectKey: "A" }),
      makeEntry({ issueKey: "A-3", projectName: "Alpha", projectKey: "A" }),
      makeEntry({ issueKey: "B-1", projectName: "Beta", projectKey: "B" }),
      makeEntry({ issueKey: "B-2", projectName: "Beta", projectKey: "B" }),
      makeEntry({ issueKey: "C-1", projectName: "Gamma", projectKey: "C" }),
      makeEntry({ issueKey: "D-1", projectName: "Delta", projectKey: "D" }),
    ]
    const result = topProjectsByIssueCount(entries, 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ projectName: "Alpha", jirasCount: 3 })
    expect(result[1]).toEqual({ projectName: "Beta", jirasCount: 2 })
    // Gamma e Delta têm 1 cada — apenas um entra no top 3
    expect(result[2]!.jirasCount).toBe(1)
  })

  it("deduplica issueKeys dentro do mesmo projeto", () => {
    const entries = [
      makeEntry({ issueKey: "A-1", projectName: "Alpha", id: "w1" }),
      makeEntry({ issueKey: "A-1", projectName: "Alpha", id: "w2" }), // mesmo issue, segundo worklog
      makeEntry({ issueKey: "A-2", projectName: "Alpha", id: "w3" }),
    ]
    const result = topProjectsByIssueCount(entries)
    expect(result[0]).toEqual({ projectName: "Alpha", jirasCount: 2 })
  })

  it("usa projectKey como fallback quando projectName está ausente", () => {
    const entries = [
      makeEntry({ issueKey: "UX-1", projectName: null, projectKey: "UX" }),
    ]
    const result = topProjectsByIssueCount(entries)
    expect(result[0]!.projectName).toBe("UX")
  })

  it("usa 'Desconhecido' quando projectName e projectKey são falsy", () => {
    const entries = [
      makeEntry({ issueKey: "X-1", projectName: null, projectKey: "" }),
    ]
    const result = topProjectsByIssueCount(entries)
    expect(result[0]!.projectName).toBe("Desconhecido")
  })

  it("retorna lista vazia para entries vazia", () => {
    expect(topProjectsByIssueCount([])).toEqual([])
  })

  it("respeita maxProjects personalizado", () => {
    const entries = [
      makeEntry({ issueKey: "A-1", projectName: "Alpha" }),
      makeEntry({ issueKey: "B-1", projectName: "Beta" }),
      makeEntry({ issueKey: "C-1", projectName: "Gamma" }),
    ]
    expect(topProjectsByIssueCount(entries, 2)).toHaveLength(2)
    expect(topProjectsByIssueCount(entries, 1)).toHaveLength(1)
  })
})

// ── Regressão QA (CA-15) ──────────────────────────────────────────────────────

describe("regressão — funções não afetam dados QA", () => {
  it("countUniqueByTypes com types QA-específicos não quebra entries UX", () => {
    const entries = [
      makeEntry({ issueKey: "UX-1", typeField: "New" }),
      makeEntry({ issueKey: "UX-2", typeField: "Usability" }),
    ]
    // Simula o que o perfil QA faria — não usa estas funções, mas confirma que
    // chamar com types QA não retorna falsos positivos
    expect(countUniqueByTypes(entries, "cenário", "automatizado")).toBe(0)
  })
})
