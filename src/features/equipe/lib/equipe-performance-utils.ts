import type { JiraLancamentoEntry } from "@/features/qa/lib/jira-worklogs-fetch"

/** Extrai apenas a parte YYYY-MM-DD de um ISO string. */
export function isoToDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Conta issueKeys únicas (case-insensitive) cujo typeField bate com algum dos
 * valores fornecidos (comparação case-insensitive e trim).
 */
export function countUniqueByTypes(entries: JiraLancamentoEntry[], ...types: string[]): number {
  const lowers = types.map((t) => t.toLowerCase())
  const seen = new Set<string>()
  for (const e of entries) {
    if (lowers.includes((e.typeField ?? "").trim().toLowerCase())) {
      seen.add(e.issueKey.toUpperCase())
    }
  }
  return seen.size
}

/**
 * Agrupa entries por projectName (fallback para projectKey ou "Desconhecido"),
 * conta issueKeys distintas por projeto e retorna os top `maxProjects` ordenados
 * por quantidade decrescente.
 */
export function topProjectsByIssueCount(
  entries: JiraLancamentoEntry[],
  maxProjects = 3,
): { projectName: string; jirasCount: number }[] {
  const map = new Map<string, Set<string>>()
  for (const e of entries) {
    const name = e.projectName?.trim() || e.projectKey?.trim() || "Desconhecido"
    if (!map.has(name)) map.set(name, new Set())
    map.get(name)!.add(e.issueKey.toUpperCase())
  }
  return [...map.entries()]
    .map(([projectName, keys]) => ({ projectName, jirasCount: keys.size }))
    .sort((a, b) => b.jirasCount - a.jirasCount)
    .slice(0, maxProjects)
}
