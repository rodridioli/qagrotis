/** Referência sequencial na suíte (1-based): CT-001, CT-002, … */
export function suiteCenarioRefAtIndex(indexInSuite: number): string {
  return `CT-${String(indexInSuite + 1).padStart(3, "0")}`
}

export function buildSuiteCenarioRefByIdMap(cenarios: { id: string }[]): Map<string, string> {
  const m = new Map<string, string>()
  for (let i = 0; i < cenarios.length; i++) {
    m.set(cenarios[i].id, suiteCenarioRefAtIndex(i))
  }
  return m
}

export function refLabelForSuiteCenario(
  refById: Map<string, string>,
  cenarioId: string,
): string {
  return refById.get(cenarioId) ?? cenarioId
}
