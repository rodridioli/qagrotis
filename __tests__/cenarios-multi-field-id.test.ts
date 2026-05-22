import { describe, it, expect } from "vitest"

// ── Testes para resolução multi-ID de custom fields Jira ──────────────────────
// Replica a lógica de issueFieldsToLancamentoPatch e parseEnvFieldIds em
// isolamento para cobrir os BDDs da Fase 2 desta sessão.

// ── Utilitários replicados ────────────────────────────────────────────────────

function parseEnvFieldIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

function parseQtdValue(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") {
    const n = Number(raw.trim().replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Replica a lógica multi-ID de issueFieldsToLancamentoPatch para qtdCenariosQA.
 * Itera todos os IDs e retorna o primeiro valor não-nulo encontrado.
 */
function resolveQtdFromFields(
  fields: Record<string, unknown>,
  fieldIds: string[],
): number | null {
  for (const id of fieldIds) {
    if (fields[id] != null) {
      const v = parseQtdValue(fields[id])
      if (v != null) return v
    }
  }
  return null
}

// ── Testes: parseEnvFieldIds ──────────────────────────────────────────────────

describe("parseEnvFieldIds", () => {
  it("retorna array vazio para undefined", () => {
    expect(parseEnvFieldIds(undefined)).toEqual([])
  })

  it("retorna array vazio para string vazia", () => {
    expect(parseEnvFieldIds("")).toEqual([])
  })

  it("retorna array de um elemento para ID único (retrocompat)", () => {
    expect(parseEnvFieldIds("customfield_10042")).toEqual(["customfield_10042"])
  })

  it("retorna múltiplos IDs separados por vírgula", () => {
    expect(parseEnvFieldIds("customfield_10042,customfield_10087")).toEqual([
      "customfield_10042",
      "customfield_10087",
    ])
  })

  it("faz trim de espaços em volta de cada ID", () => {
    expect(parseEnvFieldIds(" customfield_10042 , customfield_10087 ")).toEqual([
      "customfield_10042",
      "customfield_10087",
    ])
  })

  it("ignora entradas vazias entre vírgulas", () => {
    expect(parseEnvFieldIds("customfield_10042,,customfield_10087")).toEqual([
      "customfield_10042",
      "customfield_10087",
    ])
  })
})

// ── Testes: resolveQtdFromFields (lógica multi-ID) ────────────────────────────

describe("resolveQtdFromFields — lógica multi-ID", () => {
  // BDD Cenário 1: projeto único, campo único
  it("retorna o valor quando apenas um ID está presente nos fields", () => {
    const fields = { customfield_10042: 5 }
    expect(resolveQtdFromFields(fields, ["customfield_10042"])).toBe(5)
  })

  // BDD Cenário 2: multi-projeto, campo do 2º projeto resolvido
  it("retorna valor do 2º ID quando o 1º não está nos fields (Tipo B)", () => {
    // AGROPRR usa customfield_10042, B1R usa customfield_10087
    // Issue B1R tem apenas customfield_10087 preenchido
    const fields = { customfield_10087: 4 }
    expect(resolveQtdFromFields(fields, ["customfield_10042", "customfield_10087"])).toBe(4)
  })

  // BDD Cenário 3: usa primeiro valor não-nulo
  it("usa o primeiro ID com valor não-nulo quando múltiplos estão preenchidos", () => {
    const fields = { customfield_10042: 5, customfield_10087: 4 }
    expect(resolveQtdFromFields(fields, ["customfield_10042", "customfield_10087"])).toBe(5)
  })

  // BDD Cenário 4: nenhum campo encontrado
  it("retorna null quando nenhum dos IDs está nos fields", () => {
    const fields = { customfield_99999: 10 }
    expect(resolveQtdFromFields(fields, ["customfield_10042", "customfield_10087"])).toBeNull()
  })

  // BDD Cenário 5: array vazio de IDs
  it("retorna null quando array de IDs está vazio (campo não resolvido)", () => {
    const fields = { customfield_10042: 5 }
    expect(resolveQtdFromFields(fields, [])).toBeNull()
  })

  // Borda: campo com valor null explícito
  it("ignora campo com valor null e tenta próximo ID", () => {
    const fields = { customfield_10042: null, customfield_10087: 4 }
    expect(resolveQtdFromFields(fields, ["customfield_10042", "customfield_10087"])).toBe(4)
  })

  // Borda: campo com valor 0 (não deve ser ignorado — 0 é válido)
  it("retorna 0 quando campo tem valor 0 (não confunde com null/falsy)", () => {
    const fields = { customfield_10042: 0 }
    expect(resolveQtdFromFields(fields, ["customfield_10042"])).toBe(0)
  })

  // Borda: campo com string numérica
  it("parseia string numérica corretamente", () => {
    const fields = { customfield_10042: "7" }
    expect(resolveQtdFromFields(fields, ["customfield_10042"])).toBe(7)
  })
})

// ── Testes: integração — fallback Broken Test com multi-ID ───────────────────

interface MockEntry {
  issueKey: string
  issueType?: string | null
  qtdCenariosErro?: number | null
  qtdCenariosQA?: number | null
}

function isBrokenTest(e: MockEntry): boolean {
  return (e.issueType ?? "").toLowerCase().includes("broken")
}

function calcErroTotal(entries: MockEntry[]): number {
  const map = new Map<string, number>()
  for (const e of entries) {
    let errCount: number | null = null
    if (e.qtdCenariosErro != null && Number.isFinite(e.qtdCenariosErro)) {
      errCount = e.qtdCenariosErro
    } else if (isBrokenTest(e) && e.qtdCenariosQA != null && Number.isFinite(e.qtdCenariosQA)) {
      errCount = e.qtdCenariosQA
    }
    if (errCount != null) {
      map.set(e.issueKey, Math.max(map.get(e.issueKey) ?? 0, errCount))
    }
  }
  let total = 0
  for (const v of map.values()) total += v
  return total
}

describe("Integração: fallback Broken Test com qtdCenariosQA via multi-ID", () => {
  it("Broken Test B1R com qtdCenariosQA resolvido via 2º ID contribui para cenariosErroTotal", () => {
    // Simula: API agora retorna qtdCenariosQA = 4 para B1R-17284 (antes era null)
    const entries: MockEntry[] = [
      { issueKey: "B1R-17284", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
    ]
    expect(calcErroTotal(entries)).toBe(4)
  })

  it("mix AGROPRR (Tipo A) + B1R Broken Test (Tipo B) soma corretamente", () => {
    const entries: MockEntry[] = [
      // AGROPRR-172: tem campo Erro mas está null; tipo Tarefa → contribui 0
      { issueKey: "AGROPRR-172", issueType: "Tarefa", qtdCenariosErro: null, qtdCenariosQA: 10 },
      // AGROPRR-50: tem campo Erro preenchido → usa diretamente
      { issueKey: "AGROPRR-50", issueType: "Teste", qtdCenariosErro: 3, qtdCenariosQA: 8 },
      // B1R-17284: Broken Test, campo Erro null, usa qtdCenariosQA via multi-ID
      { issueKey: "B1R-17284", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
      // B1R-17289: Broken Test, qtdCenariosQA null → contribui 0
      { issueKey: "B1R-17289", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: null },
    ]
    // 0 + 3 + 4 + 0 = 7
    expect(calcErroTotal(entries)).toBe(7)
  })

  it("sem issues Broken Test no período → cenariosErroTotal = 0", () => {
    const entries: MockEntry[] = [
      { issueKey: "B1R-100", issueType: "Teste", qtdCenariosErro: null, qtdCenariosQA: 5 },
      { issueKey: "B1R-101", issueType: "Tarefa", qtdCenariosErro: null, qtdCenariosQA: 3 },
    ]
    expect(calcErroTotal(entries)).toBe(0)
  })
})
