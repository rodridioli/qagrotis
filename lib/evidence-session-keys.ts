/** Chaves `sessionStorage` para evidências do cenário em curso (anexos na página do CT). */
export function evScenarioStorageKey(cenarioId: string, tipo: "manual" | "auto") {
  return `qagrotis_ev_${cenarioId}_${tipo}`
}

/** Chaves por linha de histórico (suite + cenário + timestamp da execução). */
export function evHistoricoStorageKey(
  suiteId: string,
  cenarioId: string,
  timestamp: number,
  tipo: "manual" | "auto",
) {
  return `qagrotis_ev_hist_${suiteId}_${cenarioId}_${timestamp}_${tipo}`
}
