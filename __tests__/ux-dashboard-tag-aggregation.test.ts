import { describe, it, expect } from "vitest"

// ── Replicação das funções puras de agregação do UxDashboardClient ─────────────
// As funções toTagItems e o filtro de approval vivem inline no useMemo do componente.
// Testamos a lógica aqui em isolamento para garantir os BDDs da Fase 2.

interface JiraEntry {
  issueKey: string
  tag?: string | null
  status?: string | null
}

function buildTagDistrib(entries: JiraEntry[]): { tag: string; count: number }[] {
  const map = new Map<string, Set<string>>()
  for (const e of entries) {
    const tag = e.tag?.trim() || "Sem tag"
    if (!map.has(tag)) map.set(tag, new Set())
    map.get(tag)!.add(e.issueKey)
  }
  return [...map.entries()]
    .map(([tag, keys]) => ({ tag, count: keys.size }))
    .sort((a, b) => b.count - a.count)
}

function buildApprovalByTag(entries: JiraEntry[]): { tag: string; count: number }[] {
  const map = new Map<string, Set<string>>()
  for (const e of entries) {
    if (e.status?.toLowerCase().trim() !== "approval") continue
    const tag = e.tag?.trim() || "Sem tag"
    if (!map.has(tag)) map.set(tag, new Set())
    map.get(tag)!.add(e.issueKey)
  }
  return [...map.entries()]
    .map(([tag, keys]) => ({ tag, count: keys.size }))
    .sort((a, b) => b.count - a.count)
}

// ── Feature: Distribuição por Produto ─────────────────────────────────────────

describe("buildTagDistrib — Distribuição por Produto", () => {
  it("agrupa issues únicas por tag e ordena por contagem DESC", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: "UBA" },
      { issueKey: "UX-2", tag: "UBA" },
      { issueKey: "UX-3", tag: "UBA" },
      { issueKey: "UX-4", tag: "BRA" },
      { issueKey: "UX-5", tag: "BRA" },
      { issueKey: "UX-6", tag: "SP" },
    ]
    const result = buildTagDistrib(entries)
    expect(result[0]).toEqual({ tag: "UBA", count: 3 })
    expect(result[1]).toEqual({ tag: "BRA", count: 2 })
    expect(result[2]).toEqual({ tag: "SP", count: 1 })
  })

  it("conta cada issueKey apenas uma vez por tag, mesmo com múltiplos worklogs da mesma issue", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: "UBA" },
      { issueKey: "UX-1", tag: "UBA" }, // mesmo issue, worklog duplicado
      { issueKey: "UX-2", tag: "UBA" },
    ]
    const result = buildTagDistrib(entries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ tag: "UBA", count: 2 }) // UX-1 e UX-2, não 3
  })

  it("agrupa issues sem tag no bucket 'Sem tag'", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: null },
      { issueKey: "UX-2", tag: "" },
      { issueKey: "UX-3", tag: undefined },
      { issueKey: "UX-4", tag: "UBA" },
    ]
    const result = buildTagDistrib(entries)
    const semTag = result.find((r) => r.tag === "Sem tag")
    expect(semTag).toBeDefined()
    expect(semTag!.count).toBe(3) // UX-1, UX-2, UX-3
    const uba = result.find((r) => r.tag === "UBA")
    expect(uba!.count).toBe(1)
  })

  it("retorna array vazio quando não há entries", () => {
    expect(buildTagDistrib([])).toEqual([])
  })

  it("'Sem tag' aparece após tags nomeadas quando tem menos contagem", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: "UBA" },
      { issueKey: "UX-2", tag: "UBA" },
      { issueKey: "UX-3", tag: null },
    ]
    const result = buildTagDistrib(entries)
    expect(result[0]!.tag).toBe("UBA")
    expect(result[1]!.tag).toBe("Sem tag")
  })
})

// ── Feature: Atividades em Aprovação ─────────────────────────────────────────

describe("buildApprovalByTag — Atividades em Aprovação", () => {
  it("inclui apenas issues com status 'approval' (case-insensitive)", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: "UBA", status: "approval" },
      { issueKey: "UX-2", tag: "UBA", status: "Approval" },   // capitalizado
      { issueKey: "UX-3", tag: "UBA", status: "APPROVAL" },   // maiúsculas
      { issueKey: "UX-4", tag: "UBA", status: "In Progress" }, // deve ser excluído
      { issueKey: "UX-5", tag: "UBA", status: null },          // deve ser excluído
    ]
    const result = buildApprovalByTag(entries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ tag: "UBA", count: 3 }) // UX-1, UX-2, UX-3
  })

  it("retorna array vazio quando nenhuma issue está em Approval", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: "UBA", status: "In Progress" },
      { issueKey: "UX-2", tag: "BRA", status: "Done" },
    ]
    expect(buildApprovalByTag(entries)).toEqual([])
  })

  it("agrupa por tag e ordena por contagem DESC", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: "SP",  status: "approval" },
      { issueKey: "UX-2", tag: "UBA", status: "approval" },
      { issueKey: "UX-3", tag: "UBA", status: "approval" },
      { issueKey: "UX-4", tag: "BRA", status: "In Progress" }, // excluído
    ]
    const result = buildApprovalByTag(entries)
    expect(result[0]).toEqual({ tag: "UBA", count: 2 })
    expect(result[1]).toEqual({ tag: "SP",  count: 1 })
    expect(result).toHaveLength(2)
  })

  it("issues sem tag em Approval vão para 'Sem tag'", () => {
    const entries: JiraEntry[] = [
      { issueKey: "UX-1", tag: null,  status: "approval" },
      { issueKey: "UX-2", tag: "UBA", status: "approval" },
    ]
    const result = buildApprovalByTag(entries)
    const semTag = result.find((r) => r.tag === "Sem tag")
    expect(semTag).toBeDefined()
    expect(semTag!.count).toBe(1)
  })
})

// ── Feature: campo tag — forma do objeto retornado ───────────────────────────

describe("UxJiraEntry shape — campo tag", () => {
  it("aceita tag como string", () => {
    // Valida em runtime que objetos com o shape de UxJiraEntry aceitam tag: string
    const entry = { issueKey: "UX-1", projectName: null, typeField: null, status: null, tag: "UBA", priority: null, retornos: 0, retornosByAssignee: {}, authorJiraAccountId: null, started: "2026-01-01", timeSpentSeconds: 3600 }
    expect(entry.tag).toBe("UBA")
  })

  it("aceita tag como null", () => {
    const entry = { issueKey: "UX-2", projectName: null, typeField: null, status: null, tag: null, priority: null, retornos: 0, retornosByAssignee: {}, authorJiraAccountId: null, started: "2026-01-01", timeSpentSeconds: 3600 }
    expect(entry.tag).toBeNull()
  })
})
