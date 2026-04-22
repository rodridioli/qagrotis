/**
 * Agrega execuções e erros por ID de cenário a partir do JSON `historico` das suítes.
 * Cada entrada no histórico conta como uma execução; `resultado === "Erro"` incrementa erros.
 * (Mesma regra que `SuiteForm` / `getPerformanceData`.)
 */
export function aggregateHistoricoExecucoesErrosByCenarioId(
  suites: { historico: unknown }[],
): Map<string, { execucoes: number; erros: number }> {
  const stats = new Map<string, { execucoes: number; erros: number }>()
  for (const suite of suites) {
    const historico = suite.historico
    if (!Array.isArray(historico)) continue
    for (const raw of historico) {
      if (!raw || typeof raw !== "object") continue
      const item = raw as Record<string, unknown>
      const id = typeof item.id === "string" ? item.id.trim() : ""
      if (!id) continue
      let bucket = stats.get(id)
      if (!bucket) {
        bucket = { execucoes: 0, erros: 0 }
        stats.set(id, bucket)
      }
      bucket.execucoes += 1
      if (item.resultado === "Erro") bucket.erros += 1
    }
  }
  return stats
}
