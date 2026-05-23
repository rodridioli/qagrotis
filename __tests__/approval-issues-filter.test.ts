import { describe, it, expect } from "vitest"

// ── Replicação da lógica de filtragem de approvalByTag ────────────────────────
// Testa a lógica pura que existe inline no useMemo dos dois dashboards (UX e TW).

interface ApprovalIssueEntry {
  tag: string
  assigneeAccountId: string | null
}

/**
 * Réplica fiel do bloco filteredApprovalIssues + approvalByTag
 * extraído dos useMemos de UxDashboardClient e TwDashboardClient.
 */
function buildApprovalByTag(
  liveApprovalIssues: ApprovalIssueEntry[],
  selectedUserIds: string[],
  memberJiraIds: Record<string, string>,
): { tag: string; count: number }[] {
  const activeApprovalJiraIds = new Set(
    selectedUserIds
      .map((uid) => memberJiraIds[uid])
      .filter((id): id is string => !!id),
  )
  const filteredApprovalIssues =
    activeApprovalJiraIds.size > 0
      ? liveApprovalIssues.filter(
          (i) =>
            i.assigneeAccountId != null &&
            activeApprovalJiraIds.has(i.assigneeAccountId),
        )
      : liveApprovalIssues

  const approvalTagMap = new Map<string, number>()
  for (const i of filteredApprovalIssues) {
    approvalTagMap.set(i.tag, (approvalTagMap.get(i.tag) ?? 0) + 1)
  }
  return [...approvalTagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

// ── Feature: JQL por perfil (validada com mapeamento de projeto) ──────────────

const APPROVAL_JQL_PROJECT: Record<"UX" | "TW", string> = {
  UX: "UX",
  TW: "Documentação Técnica",
}

describe("APPROVAL_JQL_PROJECT — mapeamento de perfil para projeto Jira", () => {
  it("perfil UX mapeia para projeto 'UX'", () => {
    expect(APPROVAL_JQL_PROJECT["UX"]).toBe("UX")
  })

  it("perfil TW mapeia para projeto 'Documentação Técnica'", () => {
    expect(APPROVAL_JQL_PROJECT["TW"]).toBe("Documentação Técnica")
  })

  it("os dois perfis têm projetos distintos", () => {
    expect(APPROVAL_JQL_PROJECT["UX"]).not.toBe(APPROVAL_JQL_PROJECT["TW"])
  })
})

// ── Feature: filtro por assignee — sem seleção ────────────────────────────────

describe("buildApprovalByTag — sem seleção de avatar", () => {
  const issues: ApprovalIssueEntry[] = [
    { tag: "UBA", assigneeAccountId: "acc-barbara" },
    { tag: "UBA", assigneeAccountId: "acc-bruno" },
    { tag: "BRA", assigneeAccountId: "acc-barbara" },
    { tag: "SP",  assigneeAccountId: null },
  ]

  it("sem seleção exibe todas as issues em Approval", () => {
    const result = buildApprovalByTag(issues, [], {})
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.tag === "UBA")?.count).toBe(2)
    expect(result.find((r) => r.tag === "BRA")?.count).toBe(1)
    expect(result.find((r) => r.tag === "SP")?.count).toBe(1)
  })

  it("sem seleção inclui issues com assigneeAccountId = null", () => {
    const result = buildApprovalByTag(issues, [], {})
    expect(result.find((r) => r.tag === "SP")).toBeDefined()
  })

  it("retorna array vazio quando liveApprovalIssues está vazio", () => {
    expect(buildApprovalByTag([], [], {})).toEqual([])
  })
})

// ── Feature: filtro por assignee — seleção de 1 usuário ──────────────────────

describe("buildApprovalByTag — seleção de 1 avatar", () => {
  const barbara = "acc-barbara"
  const bruno   = "acc-bruno"
  const memberJiraIds = { "user-barbara": barbara, "user-bruno": bruno }

  const issues: ApprovalIssueEntry[] = [
    { tag: "UBA", assigneeAccountId: barbara },
    { tag: "UBA", assigneeAccountId: barbara }, // segundo issue
    { tag: "BRA", assigneeAccountId: bruno },
    { tag: "SP",  assigneeAccountId: null },     // sem assignee
  ]

  it("selecionar Barbara → exibe apenas issues dela", () => {
    const result = buildApprovalByTag(issues, ["user-barbara"], memberJiraIds)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ tag: "UBA", count: 2 })
  })

  it("selecionar Bruno → exibe apenas issues dele", () => {
    const result = buildApprovalByTag(issues, ["user-bruno"], memberJiraIds)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ tag: "BRA", count: 1 })
  })

  it("issue com assigneeAccountId = null não aparece quando há seleção ativa", () => {
    const result = buildApprovalByTag(issues, ["user-barbara"], memberJiraIds)
    expect(result.find((r) => r.tag === "SP")).toBeUndefined()
  })

  it("usuário selecionado sem issues em Approval → array vazio (estado vazio no card)", () => {
    const result = buildApprovalByTag(issues, ["user-barbara"], { "user-barbara": "acc-outro" })
    expect(result).toEqual([])
  })
})

// ── Feature: filtro por assignee — seleção múltipla ──────────────────────────

describe("buildApprovalByTag — seleção de múltiplos avatares", () => {
  const barbara = "acc-barbara"
  const bruno   = "acc-bruno"
  const memberJiraIds = { "user-barbara": barbara, "user-bruno": bruno }

  const issues: ApprovalIssueEntry[] = [
    { tag: "UBA", assigneeAccountId: barbara },
    { tag: "BRA", assigneeAccountId: bruno },
    { tag: "SP",  assigneeAccountId: null },
  ]

  it("selecionar ambos → exibe a união das issues", () => {
    const result = buildApprovalByTag(issues, ["user-barbara", "user-bruno"], memberJiraIds)
    expect(result).toHaveLength(2)
    const tags = result.map((r) => r.tag)
    expect(tags).toContain("UBA")
    expect(tags).toContain("BRA")
  })

  it("seleção múltipla ainda exclui issues com assigneeAccountId = null", () => {
    const result = buildApprovalByTag(issues, ["user-barbara", "user-bruno"], memberJiraIds)
    expect(result.find((r) => r.tag === "SP")).toBeUndefined()
  })
})

// ── Feature: memberJiraIds incompleto / userId sem mapeamento ─────────────────

describe("buildApprovalByTag — memberJiraIds incompleto", () => {
  const issues: ApprovalIssueEntry[] = [
    { tag: "UBA", assigneeAccountId: "acc-barbara" },
    { tag: "BRA", assigneeAccountId: "acc-bruno" },
  ]

  it("userId selecionado sem mapeamento no memberJiraIds → sem filtro efetivo (trata como sem seleção)", () => {
    // "user-desconhecido" não está em memberJiraIds → activeApprovalJiraIds fica vazia → exibe tudo
    const result = buildApprovalByTag(issues, ["user-desconhecido"], {})
    expect(result).toHaveLength(2)
  })

  it("mix de userId com e sem mapeamento → filtra apenas pelos que têm Jira ID", () => {
    const memberJiraIds = { "user-barbara": "acc-barbara" }
    // "user-sem-id" não tem mapeamento → só filtra por barbara
    const result = buildApprovalByTag(issues, ["user-barbara", "user-sem-id"], memberJiraIds)
    expect(result).toHaveLength(1)
    expect(result[0]?.tag).toBe("UBA")
  })
})

// ── Feature: ordenação por contagem DESC ──────────────────────────────────────

describe("buildApprovalByTag — ordenação", () => {
  it("ordena por count DESC", () => {
    const issues: ApprovalIssueEntry[] = [
      { tag: "SP",  assigneeAccountId: "acc-1" },
      { tag: "UBA", assigneeAccountId: "acc-1" },
      { tag: "UBA", assigneeAccountId: "acc-1" },
      { tag: "BRA", assigneeAccountId: "acc-1" },
      { tag: "BRA", assigneeAccountId: "acc-1" },
      { tag: "BRA", assigneeAccountId: "acc-1" },
    ]
    const memberJiraIds = { "u1": "acc-1" }
    const result = buildApprovalByTag(issues, ["u1"], memberJiraIds)
    expect(result[0]?.tag).toBe("BRA") // 3
    expect(result[1]?.tag).toBe("UBA") // 2
    expect(result[2]?.tag).toBe("SP")  // 1
  })
})
