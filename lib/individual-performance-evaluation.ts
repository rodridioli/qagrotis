import { z } from "zod"

/** Colunas da planilha: Não Atende … Excelente (índice 0..4). */
export const EVALUATION_LEVEL_LABELS = [
  "Não Atende",
  "Básico",
  "Médio",
  "Esperado",
  "Excelente",
] as const

/** Pesos AM…AQ da planilha (0,2 … 1,0). */
export const EVALUATION_LEVEL_WEIGHTS = [0.2, 0.4, 0.6, 0.8, 1.0] as const

const TOTAL_COMPETENCIES = 23

export type PerformanceEvaluationSectionId = "conhecimentos" | "habilidades" | "atitudes"

export interface PerformanceCompetency {
  id: string
  label: string
}

export interface PerformanceEvaluationSection {
  id: PerformanceEvaluationSectionId
  label: string
  competencies: PerformanceCompetency[]
}

export const PERFORMANCE_EVALUATION_SECTIONS: PerformanceEvaluationSection[] = [
  {
    id: "conhecimentos",
    label: "Conhecimentos",
    competencies: [
      { id: "conhecimento_tecnico", label: "Conhecimento Técnico" },
      { id: "responsabilidades", label: "Responsabilidades" },
      { id: "procedimentos_trabalho", label: "Procedimentos de Trabalho" },
      { id: "atualizacao_profissional", label: "Atualização Profissional" },
      { id: "pensamento_critico", label: "Pensamento Crítico" },
      { id: "resolucao_problemas", label: "Resolução de problemas" },
    ],
  },
  {
    id: "habilidades",
    label: "Habilidades",
    competencies: [
      { id: "relacionamento_interpessoal", label: "Relacionamento Interpessoal" },
      { id: "comunicacao", label: "Comunicação" },
      { id: "efetividade", label: "Efetividade" },
      { id: "trabalho_equipe", label: "Trabalho em Equipe" },
      { id: "foco_resultados", label: "Foco em Resultados" },
      { id: "negociacao", label: "Negociação" },
      { id: "resiliencia", label: "Resiliência" },
      { id: "inteligencia_emocional", label: "Inteligência Emocional" },
      { id: "estrategia", label: "Estratégia" },
      { id: "planejamento", label: "Planejamento" },
    ],
  },
  {
    id: "atitudes",
    label: "Atitudes",
    competencies: [
      { id: "pro_atividade", label: "Pró-Atividade" },
      { id: "criatividade_inovacao", label: "Criatividade/Inovação" },
      { id: "motivacao", label: "Motivação" },
      { id: "responsabilidade", label: "Responsabilidade" },
      { id: "flexibilidade", label: "Flexibilidade" },
      { id: "apresentacao_pessoal", label: "Apresentação Pessoal" },
      { id: "etica", label: "Ética" },
    ],
  },
]

export const PERFORMANCE_COMPETENCY_IDS: string[] = PERFORMANCE_EVALUATION_SECTIONS.flatMap((s) =>
  s.competencies.map((c) => c.id),
)

const columnIndexSchema = z.number().int().min(0).max(4)

const selectionsPartialSchema = z.record(z.string(), columnIndexSchema)

export const selectionsCompleteSchema = z
  .record(z.string(), columnIndexSchema)
  .superRefine((obj, ctx) => {
    for (const id of PERFORMANCE_COMPETENCY_IDS) {
      if (obj[id] === undefined) {
        ctx.addIssue({ code: "custom", message: `Competência em falta: ${id}`, path: [id] })
      }
    }
    const extra = Object.keys(obj).filter((k) => !PERFORMANCE_COMPETENCY_IDS.includes(k))
    if (extra.length > 0) {
      ctx.addIssue({ code: "custom", message: `Chaves inválidas: ${extra.join(", ")}` })
    }
  })

export type PerformanceSelections = Record<string, number>

/** Lê JSON do Prisma para mapa parcial ou completo. */
export function parseSelectionsJson(raw: unknown): PerformanceSelections {
  const r = selectionsPartialSchema.safeParse(raw)
  if (!r.success) return {}
  return r.data
}

/**
 * Pontuação global (planilha): soma P_j * w_j com P_j = contagem no nível j / 23; resultado 0–100 %.
 */
export function computePerformanceScorePercent(selections: PerformanceSelections): number | null {
  const complete = selectionsCompleteSchema.safeParse(selections)
  if (!complete.success) return null
  const obj = complete.data
  const counts = [0, 0, 0, 0, 0] as number[]
  for (const id of PERFORMANCE_COMPETENCY_IDS) {
    const col = obj[id]!
    counts[col] += 1
  }
  let s = 0
  for (let j = 0; j < 5; j++) {
    s += (counts[j]! / TOTAL_COMPETENCIES) * EVALUATION_LEVEL_WEIGHTS[j]!
  }
  return Math.round(s * 10_000) / 100
}

/** Percentagens por coluna dentro de uma secção (rodapé tipo planilha). */
export function computeSectionColumnPercents(
  section: PerformanceEvaluationSection,
  selections: PerformanceSelections,
): number[] {
  const n = section.competencies.length
  if (n === 0) return [0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0]
  for (const c of section.competencies) {
    const col = selections[c.id]
    if (col !== undefined && col >= 0 && col <= 4) counts[col] += 1
  }
  return counts.map((c) => Math.round((c / n) * 10_000) / 100)
}

export function scorePercentToneClass(percent: number): string {
  if (percent < 70) return "text-destructive"
  if (percent < 80) return "text-orange-600 dark:text-orange-400"
  if (percent < 90) return "text-blue-600 dark:text-blue-400"
  return "text-green-600 dark:text-green-400"
}

/** Cabeçalhos de coluna em tons pastéis (grelha de competências). */
export function columnHeaderToneClass(colIndex: number): string {
  const tones = [
    "bg-rose-50/90 text-rose-700/80 dark:bg-rose-950/30 dark:text-rose-200/90",
    "bg-orange-50/95 text-orange-800/75 dark:bg-orange-950/25 dark:text-orange-200/85",
    "bg-amber-50/95 text-amber-800/75 dark:bg-amber-950/25 dark:text-amber-100/90",
    "bg-sky-50/95 text-sky-800/75 dark:bg-sky-950/25 dark:text-sky-100/90",
    "bg-emerald-50/95 text-emerald-800/75 dark:bg-emerald-950/25 dark:text-emerald-100/90",
  ]
  return tones[colIndex] ?? "bg-muted/60 text-muted-foreground"
}

export const EVALUATION_PERIOD_SLUGS = [
  "T1_TRIMESTRE",
  "T2_TRIMESTRE",
  "T3_TRIMESTRE",
  "T4_TRIMESTRE",
  "S1_SEMESTRE",
  "S2_SEMESTRE",
] as const

export type EvaluationPeriodSlug = (typeof EVALUATION_PERIOD_SLUGS)[number]

const PERIOD_LABELS: Record<EvaluationPeriodSlug, string> = {
  T1_TRIMESTRE: "1º Trimestre",
  T2_TRIMESTRE: "2º Trimestre",
  T3_TRIMESTRE: "3º Trimestre",
  T4_TRIMESTRE: "4º Trimestre",
  S1_SEMESTRE: "1º Semestre",
  S2_SEMESTRE: "2º Semestre",
}

export function evaluationPeriodLabel(slug: string): string {
  if ((EVALUATION_PERIOD_SLUGS as readonly string[]).includes(slug)) {
    return PERIOD_LABELS[slug as EvaluationPeriodSlug]
  }
  return slug
}

export function isEvaluationPeriodSlug(s: string): s is EvaluationPeriodSlug {
  return (EVALUATION_PERIOD_SLUGS as readonly string[]).includes(s)
}

export const DEFAULT_EVALUATION_PERIOD: EvaluationPeriodSlug = "T1_TRIMESTRE"
