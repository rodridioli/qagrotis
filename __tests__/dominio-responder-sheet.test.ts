import { describe, expect, it } from "vitest"

// ── Pure logic mirrored from DominioResponderSheet ────────────────────────────
// Kept separate to not depend on React/DOM.

type Produto = { id: string; modulos: { id: string }[] }
type Respostas = Record<string, Record<string, number>>

/** Réplica exata de calcMediaGeral no componente (retorna 0, não null). */
function calcMediaGeral(produtos: Produto[], respostas: Respostas): number {
  const produtoAvgs: number[] = []
  for (const p of produtos) {
    const scores = p.modulos
      .map((m) => respostas[p.id]?.[m.id])
      .filter((v): v is number => !!v)
      .map((v) => (v / 5) * 100)
    if (scores.length > 0)
      produtoAvgs.push(scores.reduce((a, b) => a + b, 0) / scores.length)
  }
  if (produtoAvgs.length === 0) return 0
  return produtoAvgs.reduce((a, b) => a + b, 0) / produtoAvgs.length
}

/** Réplica exata de calcMediaProduto no componente. */
function calcMediaProduto(produto: Produto, respostas: Respostas): number | null {
  const scores = produto.modulos
    .map((m) => respostas[produto.id]?.[m.id])
    .filter((v): v is number => !!v)
    .map((v) => (v / 5) * 100)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/** Conta quantos módulos têm estrela (≥1). */
function countFilled(produtos: Produto[], respostas: Respostas): number {
  let count = 0
  for (const p of produtos)
    for (const m of p.modulos)
      if (respostas[p.id]?.[m.id]) count++
  return count
}

/** Retorna true quando TODOS os módulos de todos os produtos têm estrela. */
function isAllFilled(produtos: Produto[], respostas: Respostas, totalModulos: number): boolean {
  return countFilled(produtos, respostas) === totalModulos && totalModulos > 0
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const produtoA: Produto = {
  id: "p1",
  modulos: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
}

const produtoB: Produto = {
  id: "p2",
  modulos: [{ id: "m4" }, { id: "m5" }],
}

const total = produtoA.modulos.length + produtoB.modulos.length // 5

// ── calcMediaGeral ────────────────────────────────────────────────────────────

describe("calcMediaGeral (DominioResponderSheet)", () => {
  it("retorna 0 quando nenhum módulo foi avaliado", () => {
    // CA-03: Média Geral começa em 0%
    expect(calcMediaGeral([produtoA, produtoB], {})).toBe(0)
  })

  it("retorna 0 para lista vazia de produtos", () => {
    expect(calcMediaGeral([], {})).toBe(0)
  })

  it("calcula corretamente com um único produto totalmente avaliado (5 estrelas)", () => {
    // CA-03: Média Geral = 100% quando todas as estrelas são 5
    const res: Respostas = { p1: { m1: 5, m2: 5, m3: 5 } }
    expect(calcMediaGeral([produtoA, produtoB], res)).toBe(100)
  })

  it("ignora produtos sem avaliação (não divide por zero)", () => {
    // produtoB não avaliado → apenas produtoA conta na média geral
    const res: Respostas = { p1: { m1: 5, m2: 5, m3: 5 } }
    expect(calcMediaGeral([produtoA, produtoB], res)).toBe(100)
  })

  it("calcula média de médias por produto (não média simples de módulos)", () => {
    // CA-03: fórmula idêntica ao backend — média de médias por produto
    // produtoA: m1=5(100%), m2=5(100%), m3=5(100%) → média 100%
    // produtoB: m4=3(60%), m5=1(20%) → média 40%
    // média geral = (100 + 40) / 2 = 70%
    const res: Respostas = {
      p1: { m1: 5, m2: 5, m3: 5 },
      p2: { m4: 3, m5: 1 },
    }
    expect(calcMediaGeral([produtoA, produtoB], res)).toBeCloseTo(70)
  })

  it("retorna 20% quando todas as estrelas são 1", () => {
    const res: Respostas = {
      p1: { m1: 1, m2: 1, m3: 1 },
      p2: { m4: 1, m5: 1 },
    }
    expect(calcMediaGeral([produtoA, produtoB], res)).toBeCloseTo(20)
  })

  it("calcula média parcial quando apenas alguns módulos do produto foram avaliados", () => {
    // CA-03: Média Geral atualiza a cada seleção
    // produtoA: m1=5(100%), m2 e m3 não avaliados → inclui apenas m1 no cálculo do produto
    const res: Respostas = { p1: { m1: 5 } }
    // produtoA parcial: [100%] → média = 100%
    // produtoB não avaliado → não entra
    // média geral = 100%
    expect(calcMediaGeral([produtoA, produtoB], res)).toBe(100)
  })
})

// ── calcMediaProduto ──────────────────────────────────────────────────────────

describe("calcMediaProduto", () => {
  it("retorna null quando produto não foi avaliado", () => {
    expect(calcMediaProduto(produtoA, {})).toBeNull()
  })

  it("retorna null quando respostas do produto estão vazias", () => {
    expect(calcMediaProduto(produtoA, { p1: {} })).toBeNull()
  })

  it("calcula média parcial com apenas um módulo avaliado", () => {
    // CA-04: barra de progresso do produto atualiza em real-time
    const res: Respostas = { p1: { m1: 5 } }
    expect(calcMediaProduto(produtoA, res)).toBe(100)
  })

  it("calcula média de todas as estrelas do produto", () => {
    // m1=5(100%), m2=3(60%), m3=1(20%) → média = 60%
    const res: Respostas = { p1: { m1: 5, m2: 3, m3: 1 } }
    expect(calcMediaProduto(produtoA, res)).toBeCloseTo(60)
  })

  it("não usa respostas de outro produto", () => {
    const res: Respostas = { p2: { m4: 5, m5: 5 } }
    expect(calcMediaProduto(produtoA, res)).toBeNull()
  })
})

// ── countFilled / isAllFilled ─────────────────────────────────────────────────

describe("contagem de módulos preenchidos", () => {
  it("CA-02: allFilled é false quando nenhum módulo foi avaliado", () => {
    expect(isAllFilled([produtoA, produtoB], {}, total)).toBe(false)
  })

  it("CA-02: allFilled é false quando apenas alguns módulos têm nota", () => {
    const res: Respostas = { p1: { m1: 3, m2: 4, m3: 5 } } // p2 faltando
    expect(isAllFilled([produtoA, produtoB], res, total)).toBe(false)
  })

  it("CA-02: allFilled é true somente quando TODOS os módulos têm nota", () => {
    const res: Respostas = {
      p1: { m1: 3, m2: 4, m3: 5 },
      p2: { m4: 2, m5: 1 },
    }
    expect(isAllFilled([produtoA, produtoB], res, total)).toBe(true)
  })

  it("CA-02: allFilled é false quando estrela é 0 (falsy)", () => {
    const res: Respostas = {
      p1: { m1: 3, m2: 4, m3: 0 }, // 0 não conta
      p2: { m4: 2, m5: 1 },
    }
    expect(isAllFilled([produtoA, produtoB], res, total)).toBe(false)
  })

  it("CA-02: allFilled é false para lista de produtos vazia", () => {
    expect(isAllFilled([], {}, 0)).toBe(false)
  })

  it("contagem de módulos preenchidos aumenta a cada seleção", () => {
    expect(countFilled([produtoA, produtoB], {})).toBe(0)

    let res: Respostas = { p1: { m1: 5 } }
    expect(countFilled([produtoA, produtoB], res)).toBe(1)

    res = { p1: { m1: 5, m2: 3 } }
    expect(countFilled([produtoA, produtoB], res)).toBe(2)

    res = { p1: { m1: 5, m2: 3, m3: 4 }, p2: { m4: 2, m5: 1 } }
    expect(countFilled([produtoA, produtoB], res)).toBe(total)
  })

  it("módulos restantes diminuem conforme preenchimento", () => {
    const res: Respostas = { p1: { m1: 5, m2: 3, m3: 4 } }
    const filled = countFilled([produtoA, produtoB], res)
    const remaining = total - filled
    expect(remaining).toBe(2) // p2 tem 2 módulos não avaliados
  })
})

// ── BDD: fluxo completo (CA-05) ───────────────────────────────────────────────

describe("BDD: serialização de respostas para envio", () => {
  it("CA-05: flat array gerado a partir do estado contém produtoId, moduloId e estrelas", () => {
    const res: Respostas = {
      p1: { m1: 5, m2: 3, m3: 4 },
      p2: { m4: 2, m5: 1 },
    }
    const produtos = [produtoA, produtoB]
    const flat: { produtoId: string; moduloId: string; estrelas: number }[] = []
    for (const p of produtos)
      for (const m of p.modulos) {
        const estrelas = res[p.id]?.[m.id]
        if (estrelas) flat.push({ produtoId: p.id, moduloId: m.id, estrelas })
      }

    expect(flat).toHaveLength(5)
    expect(flat[0]).toEqual({ produtoId: "p1", moduloId: "m1", estrelas: 5 })
    expect(flat[2]).toEqual({ produtoId: "p1", moduloId: "m3", estrelas: 4 })
    expect(flat[4]).toEqual({ produtoId: "p2", moduloId: "m5", estrelas: 1 })
  })

  it("CA-05: não inclui módulos com estrela 0 ou indefinida no flat array", () => {
    const res: Respostas = { p1: { m1: 5, m3: 0 } } // m2 indefinido, m3 = 0
    const flat: { produtoId: string; moduloId: string; estrelas: number }[] = []
    for (const m of produtoA.modulos) {
      const estrelas = res[produtoA.id]?.[m.id]
      if (estrelas) flat.push({ produtoId: produtoA.id, moduloId: m.id, estrelas })
    }
    expect(flat).toHaveLength(1)
    expect(flat[0]?.moduloId).toBe("m1")
  })

  it("CA-05: estrelas são inteiros entre 1 e 5", () => {
    const res: Respostas = {
      p1: { m1: 1, m2: 2, m3: 5 },
      p2: { m4: 3, m5: 4 },
    }
    const flat: { estrelas: number }[] = []
    for (const p of [produtoA, produtoB])
      for (const m of p.modulos) {
        const e = res[p.id]?.[m.id]
        if (e) flat.push({ estrelas: e })
      }
    for (const item of flat) {
      expect(item.estrelas).toBeGreaterThanOrEqual(1)
      expect(item.estrelas).toBeLessThanOrEqual(5)
      expect(Number.isInteger(item.estrelas)).toBe(true)
    }
  })
})

// ── BDD: integração de cálculo (CA-03 / CA-04 combinados) ────────────────────

describe("BDD: atualização em tempo real conforme seleção de estrelas", () => {
  it("Média Geral parte de 0% e chega a 100% com todas 5 estrelas", () => {
    const produtos = [produtoA]
    let res: Respostas = {}

    expect(calcMediaGeral(produtos, res)).toBe(0)

    res = { p1: { m1: 5 } }
    expect(calcMediaGeral(produtos, res)).toBe(100)

    res = { p1: { m1: 5, m2: 5 } }
    expect(calcMediaGeral(produtos, res)).toBe(100)

    res = { p1: { m1: 5, m2: 5, m3: 5 } }
    expect(calcMediaGeral(produtos, res)).toBe(100)
  })

  it("barra de progresso do produto reflete notas parciais", () => {
    let res: Respostas = {}
    expect(calcMediaProduto(produtoA, res)).toBeNull()

    res = { p1: { m1: 5 } } // 100%
    expect(calcMediaProduto(produtoA, res)).toBe(100)

    res = { p1: { m1: 5, m2: 1 } } // (100+20)/2 = 60%
    expect(calcMediaProduto(produtoA, res)).toBeCloseTo(60)
  })
})
