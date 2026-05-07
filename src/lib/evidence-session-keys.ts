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

function listHistoricoEvidenceKeysForSuite(suiteId: string): string[] {
  const prefix = `qagrotis_ev_hist_${suiteId}_`
  const keys: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (k?.startsWith(prefix)) keys.push(k)
  }
  return keys
}

function historicoStorageTimestamp(key: string): number {
  const m = key.match(/_(\d+)_(manual|auto)$/)
  return m ? Number(m[1]) : 0
}

/** Remove snapshots de evidência do histórico mais antigos (liberta quota do `sessionStorage`). */
export function pruneOldestHistoricoEvidenceSessionKeys(suiteId: string, removeCount: number): void {
  if (removeCount <= 0) return
  const keys = listHistoricoEvidenceKeysForSuite(suiteId)
  keys.sort((a, b) => historicoStorageTimestamp(a) - historicoStorageTimestamp(b))
  for (const k of keys.slice(0, removeCount)) sessionStorage.removeItem(k)
}

/**
 * Grava JSON na sessão; em `QuotaExceededError` tenta libertar snapshots antigos da mesma suíte.
 * @returns `true` se gravou com sucesso.
 */
export function trySetSessionStorageJson(
  key: string,
  json: string,
  options?: { suiteIdForPrune?: string },
): boolean {
  try {
    sessionStorage.setItem(key, json)
    return true
  } catch (e) {
    const isQuota = e instanceof DOMException && e.name === "QuotaExceededError"
    const suiteId = options?.suiteIdForPrune
    if (!isQuota || !suiteId) return false
    for (const n of [16, 40, 80]) {
      pruneOldestHistoricoEvidenceSessionKeys(suiteId, n)
      try {
        sessionStorage.setItem(key, json)
        return true
      } catch {
        /* retry with more pruning */
      }
    }
    return false
  }
}
