/** Slugs e rótulos das secções Individual — menu lateral (MGR) ou abas (demais roles) (server-safe). */

export const INDIVIDUAL_SECTION_ORDER = [
  "ficha",
  "dominio",
  "ferias",
  "ausencias",
  "avaliacoes",
  "feedbacks",
  "conquistas",
  "pdi",
  "progressao",
] as const

export type IndividualSectionSlug = (typeof INDIVIDUAL_SECTION_ORDER)[number]

export const INDIVIDUAL_SECTION_LABELS: Record<IndividualSectionSlug, string> = {
  ficha: "Ficha",
  dominio: "Domínio",
  ferias: "Férias",
  ausencias: "Ausências",
  avaliacoes: "Avaliações",
  feedbacks: "Feedbacks",
  conquistas: "Conquistas",
  pdi: "PDI",
  progressao: "Progressão",
}

export function isIndividualSectionSlug(secao: string): secao is IndividualSectionSlug {
  return (INDIVIDUAL_SECTION_ORDER as readonly string[]).includes(secao)
}

export function individualSectionLabel(secao: string): string | undefined {
  if (!isIndividualSectionSlug(secao)) return undefined
  return INDIVIDUAL_SECTION_LABELS[secao]
}
