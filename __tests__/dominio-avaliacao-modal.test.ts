import { describe, expect, it } from "vitest"

// ── Pure logic extracted from DominioAvaliacaoModal ──────────────────────────
// These mirror the inline functions; kept separate so tests don't depend on React.

type Produto = { id: string; modulos: { id: string; nome: string }[] }
type Respostas = Record<string, Record<string, number>>

function calcProdutoMedia(produto: Produto, respostas: Respostas): number | null {
  const scores: number[] = []
  for (const modulo of produto.modulos) {
    const val = respostas[produto.id]?.[modulo.id]
    if (val) scores.push((val / 5) * 100)
  }
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function calcMediaGeral(produtos: Produto[], respostas: Respostas): number | null {
  const avgs: number[] = []
  for (const p of produtos) {
    const m = calcProdutoMedia(p, respostas)
    if (m !== null) avgs.push(m)
  }
  if (avgs.length === 0) return null
  return avgs.reduce((a, b) => a + b, 0) / avgs.length
}

function isProdutoComplete(produto: Produto, respostas: Respostas): boolean {
  return produto.modulos.every((m) => !!respostas[produto.id]?.[m.id])
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const produtoA: Produto = {
  id: "p1",
  modulos: [
    { id: "m1", nome: "Core" },
    { id: "m2", nome: "REC" },
    { id: "m3", nome: "CDP" },
  ],
}

const produtoB: Produto = {
  id: "p2",
  modulos: [
    { id: "m4", nome: "SEM" },
    { id: "m5", nome: "LAS" },
  ],
}

// ── calcProdutoMedia ──────────────────────────────────────────────────────────

describe("calcProdutoMedia", () => {
  it("retorna null quando nenhum módulo foi avaliado", () => {
    expect(calcProdutoMedia(produtoA, {})).toBeNull()
  })

  it("retorna null quando respostas do produto estão vazias", () => {
    expect(calcProdutoMedia(produtoA, { p1: {} })).toBeNull()
  })

  it("calcula média parcial com apenas alguns módulos avaliados", () => {
    const res: Respostas = { p1: { m1: 5 } }
    // apenas m1 avaliado: (5/5)*100 = 100%
    expect(calcProdutoMedia(produtoA, res)).toBe(100)
  })

  it("calcula média correta com todos os módulos avaliados", () => {
    // m1=5 (100%), m2=3 (60%), m3=1 (20%) → média = 60%
    const res: Respostas = { p1: { m1: 5, m2: 3, m3: 1 } }
    expect(calcProdutoMedia(produtoA, res)).toBeCloseTo(60)
  })

  it("retorna 100% quando todas as estrelas são 5", () => {
    const res: Respostas = { p1: { m1: 5, m2: 5, m3: 5 } }
    expect(calcProdutoMedia(produtoA, res)).toBe(100)
  })

  it("retorna 20% quando todas as estrelas são 1", () => {
    // (1/5)*100 = 20 para cada módulo
    const res: Respostas = { p1: { m1: 1, m2: 1, m3: 1 } }
    expect(calcProdutoMedia(produtoA, res)).toBe(20)
  })

  it("não usa respostas de outro produto", () => {
    const res: Respostas = { p2: { m4: 5, m5: 5 } }
    expect(calcProdutoMedia(produtoA, res)).toBeNull()
  })
})

// ── calcMediaGeral ────────────────────────────────────────────────────────────

describe("calcMediaGeral", () => {
  it("retorna null quando nenhum produto foi avaliado", () => {
    expect(calcMediaGeral([produtoA, produtoB], {})).toBeNull()
  })

  it("retorna null para lista vazia de produtos", () => {
    expect(calcMediaGeral([], {})).toBeNull()
  })

  it("calcula média geral com um produto avaliado", () => {
    const res: Respostas = { p1: { m1: 5, m2: 5, m3: 5 } }
    expect(calcMediaGeral([produtoA, produtoB], res)).toBe(100)
  })

  it("calcula média geral com todos os produtos avaliados", () => {
    // produtoA: (100+100+100)/3 = 100%
    // produtoB: (60+20)/2 = 40%
    // média geral: (100+40)/2 = 70%
    const res: Respostas = {
      p1: { m1: 5, m2: 5, m3: 5 },
      p2: { m4: 3, m5: 1 },
    }
    expect(calcMediaGeral([produtoA, produtoB], res)).toBeCloseTo(70)
  })

  it("ignora produtos sem nenhuma avaliação na média geral", () => {
    const res: Respostas = { p1: { m1: 5, m2: 5, m3: 5 } }
    // apenas produtoA avaliado → média geral = média de produtoA = 100%
    expect(calcMediaGeral([produtoA, produtoB], res)).toBe(100)
  })
})

// ── isProdutoComplete ─────────────────────────────────────────────────────────

describe("isProdutoComplete", () => {
  it("retorna false quando nenhum módulo foi avaliado", () => {
    expect(isProdutoComplete(produtoA, {})).toBe(false)
  })

  it("retorna false quando apenas alguns módulos foram avaliados", () => {
    const res: Respostas = { p1: { m1: 3, m2: 4 } } // m3 faltando
    expect(isProdutoComplete(produtoA, res)).toBe(false)
  })

  it("retorna true quando todos os módulos foram avaliados", () => {
    const res: Respostas = { p1: { m1: 3, m2: 4, m3: 5 } }
    expect(isProdutoComplete(produtoA, res)).toBe(true)
  })

  it("retorna false quando estrela é 0 (não avaliado)", () => {
    const res: Respostas = { p1: { m1: 3, m2: 4, m3: 0 } }
    expect(isProdutoComplete(produtoA, res)).toBe(false)
  })

  it("não confunde respostas de outros produtos", () => {
    // produtoB totalmente avaliado, produtoA não
    const res: Respostas = { p2: { m4: 5, m5: 5 } }
    expect(isProdutoComplete(produtoA, res)).toBe(false)
    expect(isProdutoComplete(produtoB, res)).toBe(true)
  })

  it("produto sem módulos é considerado completo (edge case)", () => {
    const vazio: Produto = { id: "v1", modulos: [] }
    expect(isProdutoComplete(vazio, {})).toBe(true)
  })
})

// ── BDD: progresso da avaliação (AC-01, AC-03, AC-12) ────────────────────────

describe("BDD: fluxo de progresso", () => {
  const produtos = [produtoA, produtoB]

  it("AC-01: botão Próximo bloqueado quando produto atual incompleto", () => {
    const res: Respostas = { p1: { m1: 3 } } // m2 e m3 faltando
    expect(isProdutoComplete(produtoA, res)).toBe(false)
  })

  it("AC-01: botão Próximo liberado quando produto atual completo", () => {
    const res: Respostas = { p1: { m1: 3, m2: 4, m3: 5 } }
    expect(isProdutoComplete(produtoA, res)).toBe(true)
  })

  it("AC-03: respostas do produto anterior são preservadas ao navegar de volta", () => {
    let res: Respostas = {}
    // Preenche produto A
    res = { ...res, p1: { m1: 5, m2: 3, m3: 4 } }
    // Avança para produto B e preenche
    res = { ...res, p2: { m4: 2, m5: 5 } }
    // Volta para produto A — respostas de p1 devem permanecer
    expect(res["p1"]).toEqual({ m1: 5, m2: 3, m3: 4 })
    expect(isProdutoComplete(produtoA, res)).toBe(true)
  })

  it("AC-12: contagem de produtos concluídos calcula barra de progresso", () => {
    const res: Respostas = {
      p1: { m1: 5, m2: 5, m3: 5 }, // completo
      // p2 não avaliado
    }
    const concluidoCount = produtos.filter((p) => isProdutoComplete(p, res)).length
    const progressPercent = (concluidoCount / produtos.length) * 100
    expect(concluidoCount).toBe(1)
    expect(progressPercent).toBe(50)
  })

  it("AC-12: progresso 100% quando todos os produtos concluídos", () => {
    const res: Respostas = {
      p1: { m1: 5, m2: 5, m3: 5 },
      p2: { m4: 3, m5: 4 },
    }
    const concluidoCount = produtos.filter((p) => isProdutoComplete(p, res)).length
    expect(concluidoCount).toBe(2)
    expect((concluidoCount / produtos.length) * 100).toBe(100)
  })
})
