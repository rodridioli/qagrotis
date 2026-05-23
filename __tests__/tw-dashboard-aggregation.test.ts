import { describe, it, expect } from "vitest"

// ── Replicação das funções puras de agregação do TwDashboardClient ────────────
// Testamos a lógica em isolamento — mesma abordagem do ux-dashboard-tag-aggregation.test.ts

interface JiraEntry {
  issueKey: string
  typeField?: string | null
  status?: string | null
  tag?: string | null
  priority?: string | null
  retornos?: number
  retornosByAssignee?: Record<string, number>
  authorJiraAccountId?: string | null
  started: string
  timeSpentSeconds: number
}

interface TwYearTotals {
  novasDocs: number
  revisoes: number
  outrasAtividades: number
  criticos: number
  aguardando: number
  retornos: number
  novasDocsSeconds: number
  revisoesSeconds: number
  outrasAtividadesSeconds: number
}

// Réplica fiel de aggregateTwYearTotals (TwDashboardClient.tsx)
function aggregateTwYearTotals(entries: JiraEntry[], activeAccountIds?: Set<string>): TwYearTotals {
  const novasDocs = new Set<string>()
  const revisoes = new Set<string>()
  let outrasAtividades = new Set<string>()
  const criticos = new Set<string>()
  const ag = new Set<string>()
  const retornosPerIssue = new Map<string, number>()

  let novasDocsSeconds = 0
  let revisoesSeconds = 0
  let outrasAtividadesSeconds = 0

  for (const e of entries) {
    const tf = (e.typeField ?? "").trim().toLowerCase()
    const s = e.timeSpentSeconds
    if (tf === "new documentation") { novasDocs.add(e.issueKey); novasDocsSeconds += s }
    else if (tf === "documentation review") { revisoes.add(e.issueKey); revisoesSeconds += s }
    else if (tf === "others" || tf === "other") { outrasAtividades.add(e.issueKey); outrasAtividadesSeconds += s }
    if (e.priority?.toLowerCase().trim() === "critical") criticos.add(e.issueKey)
    if (e.status?.toLowerCase().trim() === "approval") ag.add(e.issueKey)
    const r = activeAccountIds && activeAccountIds.size > 0
      ? Array.from(activeAccountIds).reduce((acc, id) => acc + (e.retornosByAssignee?.[id] ?? 0), 0)
      : (e.retornos ?? 0)
    if (r > 0) {
      retornosPerIssue.set(e.issueKey, Math.max(retornosPerIssue.get(e.issueKey) ?? 0, r))
    }
  }

  // Residual: issues sem tipo mapeado → outrasAtividades
  const typedIssues = new Set([...novasDocs, ...revisoes, ...outrasAtividades])
  for (const e of entries) {
    if (!typedIssues.has(e.issueKey)) { outrasAtividades.add(e.issueKey); outrasAtividadesSeconds += e.timeSpentSeconds }
  }

  const retornos = Array.from(retornosPerIssue.values()).reduce((s, v) => s + v, 0)

  return {
    novasDocs: novasDocs.size,
    revisoes: revisoes.size,
    outrasAtividades: outrasAtividades.size,
    criticos: criticos.size,
    aguardando: ag.size,
    retornos,
    novasDocsSeconds,
    revisoesSeconds,
    outrasAtividadesSeconds,
  }
}

function makeEntry(issueKey: string, typeField: string | null, extras: Partial<JiraEntry> = {}): JiraEntry {
  return { issueKey, typeField, started: "2026-01-15", timeSpentSeconds: 3600, ...extras }
}

// ── Feature: Mapeamento de typeField TW ───────────────────────────────────────

describe("aggregateTwYearTotals — mapeamento de typeField", () => {
  it("typeField 'New documentation' (qualquer capitalização) → novasDocs", () => {
    const entries = [
      makeEntry("TW-1", "New documentation"),
      makeEntry("TW-2", "NEW DOCUMENTATION"),
      makeEntry("TW-3", "new documentation"),
      makeEntry("TW-4", "  New documentation  "), // com espaços
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.novasDocs).toBe(4)
    expect(result.revisoes).toBe(0)
    expect(result.outrasAtividades).toBe(0)
  })

  it("typeField 'Documentation Review' (qualquer capitalização) → revisoes", () => {
    const entries = [
      makeEntry("TW-10", "Documentation Review"),
      makeEntry("TW-11", "DOCUMENTATION REVIEW"),
      makeEntry("TW-12", "documentation review"),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.revisoes).toBe(3)
    expect(result.novasDocs).toBe(0)
    expect(result.outrasAtividades).toBe(0)
  })

  it("typeField 'Others' ou 'Other' → outrasAtividades (não no residual)", () => {
    const entries = [
      makeEntry("TW-20", "Others"),
      makeEntry("TW-21", "others"),
      makeEntry("TW-22", "Other"),
      makeEntry("TW-23", "other"),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.outrasAtividades).toBe(4)
    expect(result.novasDocs).toBe(0)
    expect(result.revisoes).toBe(0)
  })

  it("typeField não mapeado (ex: 'Improvement', null, '') → outrasAtividades (residual)", () => {
    const entries = [
      makeEntry("TW-30", "Improvement"),      // tipo UX — não mapeado no TW
      makeEntry("TW-31", "Usability"),         // tipo UX — não mapeado no TW
      makeEntry("TW-32", null),                // sem tipo
      makeEntry("TW-33", ""),                  // tipo vazio
      makeEntry("TW-34", "Qualquer coisa"),    // tipo desconhecido
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.outrasAtividades).toBe(5)
    expect(result.novasDocs).toBe(0)
    expect(result.revisoes).toBe(0)
  })
})

// ── Feature: Issues únicas — sem double-counting ──────────────────────────────

describe("aggregateTwYearTotals — issues únicas", () => {
  it("mesmo issue com múltiplos worklogs conta uma única vez", () => {
    const entries = [
      makeEntry("TW-1", "New documentation", { timeSpentSeconds: 3600 }),
      makeEntry("TW-1", "New documentation", { timeSpentSeconds: 1800 }), // worklog duplicado
      makeEntry("TW-1", "New documentation", { timeSpentSeconds: 900 }),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.novasDocs).toBe(1) // apenas TW-1
    expect(result.novasDocsSeconds).toBe(3600 + 1800 + 900) // horas somam todos os worklogs
  })

  it("issue que aparece em novasDocs não conta novamente no residual", () => {
    const entries = [
      makeEntry("TW-1", "New documentation"),
      makeEntry("TW-2", "Documentation Review"),
      makeEntry("TW-3", "Others"),
    ]
    const result = aggregateTwYearTotals(entries)
    // Residual deve ser 0 — todos os tipos foram mapeados
    expect(result.novasDocs).toBe(1)
    expect(result.revisoes).toBe(1)
    expect(result.outrasAtividades).toBe(1)
    // Total de issues: 3 (sem duplicação no residual)
    const total = result.novasDocs + result.revisoes + result.outrasAtividades
    expect(total).toBe(3)
  })

  it("issue sem tipo não aparece em novasDocs nem revisoes", () => {
    const entries = [
      makeEntry("TW-5", null),
      makeEntry("TW-6", ""),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.novasDocs).toBe(0)
    expect(result.revisoes).toBe(0)
    expect(result.outrasAtividades).toBe(2) // caem no residual
  })
})

// ── Feature: Acumulação de segundos ───────────────────────────────────────────

describe("aggregateTwYearTotals — acumulação de segundos", () => {
  it("novasDocsSeconds soma todos os worklogs de issues novasDocs", () => {
    const entries = [
      makeEntry("TW-1", "New documentation", { timeSpentSeconds: 7200 }),
      makeEntry("TW-1", "New documentation", { timeSpentSeconds: 3600 }), // segundo worklog
      makeEntry("TW-2", "New documentation", { timeSpentSeconds: 1800 }),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.novasDocsSeconds).toBe(7200 + 3600 + 1800)
  })

  it("revisoesSeconds soma apenas worklogs de revisoes", () => {
    const entries = [
      makeEntry("TW-10", "Documentation Review", { timeSpentSeconds: 5400 }),
      makeEntry("TW-11", "Documentation Review", { timeSpentSeconds: 2700 }),
      makeEntry("TW-12", "New documentation",    { timeSpentSeconds: 9000 }), // não conta
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.revisoesSeconds).toBe(5400 + 2700)
    expect(result.novasDocsSeconds).toBe(9000)
  })

  it("outrasAtividadesSeconds inclui segundos do residual", () => {
    const entries = [
      makeEntry("TW-20", "Others",      { timeSpentSeconds: 3600 }),
      makeEntry("TW-21", "Improvement", { timeSpentSeconds: 1800 }), // residual
      makeEntry("TW-22", null,          { timeSpentSeconds: 900 }),  // residual
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.outrasAtividadesSeconds).toBe(3600 + 1800 + 900)
  })
})

// ── Feature: Críticos e Aguardando ────────────────────────────────────────────

describe("aggregateTwYearTotals — críticos e aguardando", () => {
  it("issues com priority 'critical' (case-insensitive) são contados", () => {
    const entries = [
      makeEntry("TW-1", "New documentation", { priority: "critical" }),
      makeEntry("TW-2", "New documentation", { priority: "Critical" }),
      makeEntry("TW-3", "New documentation", { priority: "CRITICAL" }),
      makeEntry("TW-4", "New documentation", { priority: "high" }), // não crítico
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.criticos).toBe(3)
  })

  it("issues com status 'approval' (case-insensitive) são contadas em aguardando", () => {
    const entries = [
      makeEntry("TW-1", "Documentation Review", { status: "approval" }),
      makeEntry("TW-2", "Documentation Review", { status: "Approval" }),
      makeEntry("TW-3", "Documentation Review", { status: "In Progress" }), // excluído
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.aguardando).toBe(2)
  })
})

// ── Feature: Retornos ─────────────────────────────────────────────────────────

describe("aggregateTwYearTotals — retornos", () => {
  it("retornos somam o valor máximo por issue única", () => {
    const entries = [
      makeEntry("TW-1", "New documentation", { retornos: 3 }),
      makeEntry("TW-1", "New documentation", { retornos: 3 }), // mesmo issue, mesmo valor
      makeEntry("TW-2", "Others",            { retornos: 2 }),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.retornos).toBe(5) // 3 (TW-1 máx) + 2 (TW-2)
  })

  it("sem retornos → retornos = 0", () => {
    const entries = [
      makeEntry("TW-1", "New documentation", { retornos: 0 }),
    ]
    const result = aggregateTwYearTotals(entries)
    expect(result.retornos).toBe(0)
  })

  it("filtra retornosByAssignee quando activeAccountIds está preenchido", () => {
    const acc = "acc-tw-member"
    const entries = [
      makeEntry("TW-1", "Documentation Review", {
        retornosByAssignee: { [acc]: 4, "outro-acc": 7 },
        retornos: 11,
      }),
    ]
    // Com seleção: usa retornosByAssignee[acc]
    const withFilter = aggregateTwYearTotals(entries, new Set([acc]))
    expect(withFilter.retornos).toBe(4)

    // Sem seleção: usa retornos total
    const withoutFilter = aggregateTwYearTotals(entries)
    expect(withoutFilter.retornos).toBe(11)
  })
})

// ── Feature: Lista vazia ──────────────────────────────────────────────────────

describe("aggregateTwYearTotals — lista vazia", () => {
  it("retorna zeros quando entries está vazio", () => {
    const result = aggregateTwYearTotals([])
    expect(result).toEqual({
      novasDocs: 0,
      revisoes: 0,
      outrasAtividades: 0,
      criticos: 0,
      aguardando: 0,
      retornos: 0,
      novasDocsSeconds: 0,
      revisoesSeconds: 0,
      outrasAtividadesSeconds: 0,
    })
  })
})

// ── Feature: Cards TW ausentes no DOM (shape verificado por tipo) ─────────────

describe("TW dashboard — cards UX não existem no TW", () => {
  it("TwYearTotals não contém campos UX-específicos", () => {
    const result = aggregateTwYearTotals([])
    // Campos UX que NÃO devem existir no TW
    expect((result as Record<string, unknown>).novosPrototipos).toBeUndefined()
    expect((result as Record<string, unknown>).melhorias).toBeUndefined()
    expect((result as Record<string, unknown>).ajustes).toBeUndefined()
    expect((result as Record<string, unknown>).pesquisa).toBeUndefined()
    expect((result as Record<string, unknown>).usabilidade).toBeUndefined()
  })

  it("TwYearTotals contém exatamente os campos TW esperados", () => {
    const result = aggregateTwYearTotals([])
    const keys = Object.keys(result).sort()
    expect(keys).toEqual([
      "aguardando",
      "criticos",
      "novasDocs",
      "novasDocsSeconds",
      "outrasAtividades",
      "outrasAtividadesSeconds",
      "retornos",
      "revisoes",
      "revisoesSeconds",
    ])
  })
})
