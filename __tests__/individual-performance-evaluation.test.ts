import { describe, expect, it } from "vitest"
import {
  computePerformanceScorePercent,
  PERFORMANCE_COMPETENCY_IDS,
} from "@/lib/individual-performance-evaluation"

function allAtLevel(level: 0 | 1 | 2 | 3 | 4): Record<string, number> {
  const o: Record<string, number> = {}
  for (const id of PERFORMANCE_COMPETENCY_IDS) {
    o[id] = level
  }
  return o
}

describe("computePerformanceScorePercent", () => {
  it("retorna null quando faltam competências", () => {
    expect(computePerformanceScorePercent({})).toBeNull()
    const partial = allAtLevel(4)
    delete partial[PERFORMANCE_COMPETENCY_IDS[0]!]
    expect(computePerformanceScorePercent(partial)).toBeNull()
  })

  it("todas em Excelente → 100%", () => {
    expect(computePerformanceScorePercent(allAtLevel(4))).toBe(100)
  })

  it("todas em Não Atende → 20%", () => {
    expect(computePerformanceScorePercent(allAtLevel(0))).toBe(20)
  })

  it("mistura alinhada à planilha (pesos 0,2 … 1,0)", () => {
    const sel = allAtLevel(4)
    // força 4 em Esperado (3) e 19 em Excelente (4)
    const ids = [...PERFORMANCE_COMPETENCY_IDS]
    for (let i = 0; i < 4; i++) {
      sel[ids[i]!] = 3
    }
    const p = computePerformanceScorePercent(sel)
    expect(p).not.toBeNull()
    const raw = (4 / 23) * 0.8 + (19 / 23) * 1.0
    expect(p).toBeCloseTo(raw * 100, 1)
  })
})
