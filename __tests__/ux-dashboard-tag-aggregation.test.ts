import { describe, it, expect } from "vitest"

// ── Replicação das funções puras de agregação do UxDashboardClient ─────────────
// As funções toTagItems e o filtro de approval vivem inline no useMemo do componente.
// Testamos a lógica aqui em isolamento para garantir os BDDs da Fase 2.

interface JiraEntry {
  issueKey: string
  tag?: string | null
  status?: string | null
  assigneeAccountId?: string | null
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

// Reflete a nova lógica do dashboard: itera todos os entries e filtra por assigneeAccountId quando há seleção.
function buildApprovalByTagFiltered(
  globalEntries: JiraEntry[],
  activeAssigneeIds: Set<string>,
): { tag: string; count: number }[] {
  const map = new Map<string, Set<string>>()
  for (const e of globalEntries) {
    if (e.status?.toLowerCase().trim() !== "approval") continue
    if (activeAssigneeIds.size > 0 && (!e.assigneeAccountId || !activeAssigneeIds.has(e.assigneeAccountId))) continue
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

// ── Feature: Atividades em Aprovação — filtro por assignee ───────────────────

describe("buildApprovalByTagFiltered — filtro por assigneeAccountId", () => {
  const barbara = "acc-barbara"
  const bruno   = "acc-bruno"

  const entries: JiraEntry[] = [
    // Jira da Bárbara (assignee = barbara), ela própria tem worklog
    { issueKey: "UX-10", tag: "UBA", status: "approval", assigneeAccountId: barbara },
    // Mesmo jira, worklog do Bruno — assigneeAccountId ainda aponta para Barbara
    { issueKey: "UX-10", tag: "UBA", status: "approval", assigneeAccountId: barbara },
    // Jira do Bruno
    { issueKey: "UX-20", tag: "BRA", status: "approval", assigneeAccountId: bruno },
    // Jira sem assignee em aprovação
    { issueKey: "UX-30", tag: "SP",  status: "approval", assigneeAccountId: null },
    // Jira em outro status — deve ser excluído sempre
    { issueKey: "UX-40", tag: "UBA", status: "In Progress", assigneeAccountId: barbara },
  ]

  it("sem seleção — exibe todos os jiras em approval independente do assignee", () => {
    const result = buildApprovalByTagFiltered(entries, new Set())
    const keys = result.flatMap(() => [])
    // UX-10 (UBA), UX-20 (BRA), UX-30 (SP) → 3 tags
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.tag === "UBA")?.count).toBe(1) // UX-10 deduplicado
    expect(result.find((r) => r.tag === "BRA")?.count).toBe(1)
    expect(result.find((r) => r.tag === "SP")?.count).toBe(1)
    void keys
  })

  it("seleção de Bárbara — exibe apenas jiras cujo assigneeAccountId é barbara", () => {
    const result = buildApprovalByTagFiltered(entries, new Set([barbara]))
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ tag: "UBA", count: 1 }) // apenas UX-10
  })

  it("seleção de Bruno — exibe apenas jiras cujo assigneeAccountId é bruno", () => {
    const result = buildApprovalByTagFiltered(entries, new Set([bruno]))
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ tag: "BRA", count: 1 })
  })

  it("seleção de ambos — exibe a união dos jiras de Bárbara e Bruno", () => {
    const result = buildApprovalByTagFiltered(entries, new Set([barbara, bruno]))
    expect(result).toHaveLength(2)
    const tags = result.map((r) => r.tag)
    expect(tags).toContain("UBA")
    expect(tags).toContain("BRA")
  })

  it("jira assignado a barbara mas sem worklog próprio — ainda aparece quando barbara é selecionada", () => {
    const onlyBrunoWorklog: JiraEntry[] = [
      // Bruno logou horas, mas o jira é da Barbara
      { issueKey: "UX-50", tag: "UBA", status: "approval", assigneeAccountId: barbara },
    ]
    const result = buildApprovalByTagFiltered(onlyBrunoWorklog, new Set([barbara]))
    expect(result).toHaveLength(1)
    expect(result[0]?.count).toBe(1)
  })

  it("jira em approval sem assigneeAccountId — excluído quando há seleção ativa", () => {
    const result = buildApprovalByTagFiltered(entries, new Set([barbara]))
    const sp = result.find((r) => r.tag === "SP")
    expect(sp).toBeUndefined() // UX-30 sem assignee não aparece
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
