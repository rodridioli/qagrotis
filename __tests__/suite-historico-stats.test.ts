import { describe, it, expect } from "vitest"
import { aggregateHistoricoExecucoesErrosByCenarioId } from "@/lib/suite-historico-stats"

describe("aggregateHistoricoExecucoesErrosByCenarioId", () => {
  it("agrega execuções e erros por id de cenário em todas as suítes", () => {
    const suites = [
      {
        historico: [
          { id: "CT-001", resultado: "Sucesso" },
          { id: "CT-001", resultado: "Erro" },
        ],
      },
      {
        historico: [{ id: "CT-001", resultado: "Sucesso" }],
      },
    ]
    const m = aggregateHistoricoExecucoesErrosByCenarioId(suites)
    expect(m.get("CT-001")).toEqual({ execucoes: 3, erros: 1 })
  })

  it("ignora histórico inválido ou id vazio", () => {
    const m = aggregateHistoricoExecucoesErrosByCenarioId([
      { historico: null },
      { historico: [{ resultado: "Erro" }] },
      { historico: [{ id: "  CT-2  ", resultado: "Pendente" }] },
    ])
    expect(m.get("CT-2")).toEqual({ execucoes: 1, erros: 0 })
  })
})
