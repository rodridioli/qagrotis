/**
 * Atribui uma linha de `suite.historico` ao e-mail (minúsculas) de quem executou,
 * alinhado ao dashboard: `executadoPor` quando existir; senão autor do cenário.
 */
export type HistoricoItemLike = {
  id: string
  executadoPor?: string
}

export function resolveHistoricoRunnerEmailKey(
  h: HistoricoItemLike,
  scenarioAuthorEmailByScenarioId: Map<string, string>,
  options: {
    knownEmailKeys: Set<string>
    /** nome exato (trim) → e-mail minúsculas */
    nameExactToEmailKey: Map<string, string>
  },
): string | null {
  const raw = (h.executadoPor ?? "").trim()
  if (raw) {
    const lower = raw.toLowerCase()
    if (options.knownEmailKeys.has(lower)) return lower
    const byName = options.nameExactToEmailKey.get(raw)
    if (byName) return byName
    if (raw.includes("@")) return lower
    return null
  }
  return scenarioAuthorEmailByScenarioId.get(h.id) ?? null
}
