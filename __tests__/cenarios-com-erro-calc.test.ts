import { describe, it, expect } from "vitest"

// ── Replicação da lógica pura de computeStats (IndividualLancamentosSection) ──
// A função computeStats vive no componente cliente e não pode ser importada diretamente.
// Testamos a lógica de cálculo de qtdCenariosErroTotal em isolamento para
// garantir os BDDs definidos na Fase 2.

interface Entry {
  issueKey: string
  issueType?: string | null
  qtdCenariosErro?: number | null
  qtdCenariosQA?: number | null
}

function isBrokenTest(e: Entry): boolean {
  return (e.issueType ?? "").toLowerCase().includes("broken")
}

/**
 * Replica a lógica corrigida do bloco de qtdErroByIssue em computeStats.
 * Retorna o total de cenários com erro para o conjunto de entries.
 */
function calcCenariosErroTotal(entries: Entry[]): number {
  const qtdErroByIssue = new Map<string, number>()

  for (const e of entries) {
    // 1. Campo "Qtd. Cenários com Erro" preenchido → usa diretamente (Tipo A)
    // 2. Campo null + issue é "Broken Test" → fallback "Qtd. Cenários QA" (Tipo B)
    // 3. Caso contrário → contribuição zero
    let errCount: number | null = null
    if (e.qtdCenariosErro != null && Number.isFinite(e.qtdCenariosErro)) {
      errCount = e.qtdCenariosErro
    } else if (
      isBrokenTest(e) &&
      e.qtdCenariosQA != null &&
      Number.isFinite(e.qtdCenariosQA)
    ) {
      errCount = e.qtdCenariosQA
    }
    if (errCount != null) {
      const prev = qtdErroByIssue.get(e.issueKey) ?? 0
      qtdErroByIssue.set(e.issueKey, Math.max(prev, errCount))
    }
  }

  let total = 0
  for (const v of qtdErroByIssue.values()) {
    total += v
  }
  return total
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Cenários com Erro — cálculo de qtdCenariosErroTotal", () => {
  // BDD Cenário 1: issue Tipo A com campo preenchido
  it("usa qtdCenariosErro quando preenchido, independente do tipo", () => {
    const entries: Entry[] = [
      { issueKey: "AGROPRR-1", issueType: "Teste", qtdCenariosErro: 5, qtdCenariosQA: 10 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(5)
  })

  // BDD Cenário 2: Tipo B — Broken Test sem campo Erro
  it("usa qtdCenariosQA como fallback quando issueType é Broken Test e qtdCenariosErro é null", () => {
    const entries: Entry[] = [
      { issueKey: "B1R-100", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(4)
  })

  // BDD Cenário 3: Tipo A campo vazio + Broken Test
  it("usa qtdCenariosQA quando qtdCenariosErro é null e issueType contém 'broken'", () => {
    const entries: Entry[] = [
      { issueKey: "AGROPRR-2", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 7 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(7)
  })

  // BDD Cenário 4: não-Broken Test sem campo Erro
  it("contribui 0 quando qtdCenariosErro é null e issueType não é Broken Test", () => {
    const entries: Entry[] = [
      { issueKey: "AGROPRR-3", issueType: "Teste", qtdCenariosErro: null, qtdCenariosQA: 8 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(0)
  })

  // BDD Cenário 5: deduplicação — múltiplos worklogs da mesma issue
  it("deduplica por issueKey usando MAX (não soma worklogs repetidos)", () => {
    const entries: Entry[] = [
      { issueKey: "B1R-100", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
      { issueKey: "B1R-100", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
      { issueKey: "B1R-100", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(4)
  })

  // BDD Cenário 6: Broken Test com qtdCenariosQA também null
  it("contribui 0 quando Broken Test mas qtdCenariosQA também é null", () => {
    const entries: Entry[] = [
      { issueKey: "B1R-200", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: null },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(0)
  })

  // BDD Cenário 7: mix de projetos Tipo A e Tipo B
  it("soma corretamente mix de Tipo A (com campo) e Tipo B (Broken Test sem campo)", () => {
    const entries: Entry[] = [
      // AGROPRR-172: Tipo A, qtdCenariosErro null, tipo Tarefa → contribui 0
      { issueKey: "AGROPRR-172", issueType: "Tarefa", qtdCenariosErro: null, qtdCenariosQA: 10 },
      // B1R-17284: Tipo B, Broken Test, qtdCenariosQA = 4 → contribui 4
      { issueKey: "B1R-17284", issueType: "Broken Test", qtdCenariosErro: null, qtdCenariosQA: 4 },
      // AGROPRR-50: Tipo A, qtdCenariosErro = 3 → contribui 3
      { issueKey: "AGROPRR-50", issueType: "Teste", qtdCenariosErro: 3, qtdCenariosQA: 10 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(7)
  })

  // Borda: qtdCenariosErro = 0 (campo preenchido com zero) não é tratado como null
  it("trata qtdCenariosErro = 0 como valor válido (não confunde com null)", () => {
    const entries: Entry[] = [
      { issueKey: "AGROPRR-99", issueType: "Broken Test", qtdCenariosErro: 0, qtdCenariosQA: 5 },
    ]
    // qtdCenariosErro está preenchido (= 0), então não usa fallback
    expect(calcCenariosErroTotal(entries)).toBe(0)
  })

  // Borda: issueType com variações de case (ex: "broken test", "BROKEN TEST")
  it("detecta Broken Test de forma case-insensitive", () => {
    const entries: Entry[] = [
      { issueKey: "B1R-300", issueType: "BROKEN TEST", qtdCenariosErro: null, qtdCenariosQA: 6 },
      { issueKey: "B1R-301", issueType: "broken test", qtdCenariosErro: null, qtdCenariosQA: 2 },
    ]
    expect(calcCenariosErroTotal(entries)).toBe(8)
  })

  // Borda: lista vazia
  it("retorna 0 para lista vazia de entries", () => {
    expect(calcCenariosErroTotal([])).toBe(0)
  })
})
