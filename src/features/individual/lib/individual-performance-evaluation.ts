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

/** Fundo e borda do cartão de pontuação (mesmas faixas que {@link scorePercentToneClass}). */
export function scorePercentCardShellClass(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) {
    return "border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900/35"
  }
  if (percent < 70) {
    return "border-red-200/90 bg-red-50/95 dark:border-red-900/55 dark:bg-red-950/40"
  }
  if (percent < 80) {
    return "border-orange-200/90 bg-orange-50/95 dark:border-orange-900/50 dark:bg-orange-950/30"
  }
  if (percent < 90) {
    return "border-sky-200/90 bg-sky-50/95 dark:border-sky-900/50 dark:bg-sky-950/30"
  }
  return "border-emerald-200/90 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/30"
}

/** Texto da pontuação — mesma origem de cor que os headers de coluna da tabela. */
export function scorePercentColumnHeaderTextClass(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) return "text-text-secondary"
  if (percent >= 90) return EVALUATION_COLUMN_HEADER_TEXT[4]!
  if (percent >= 80) return EVALUATION_COLUMN_HEADER_TEXT[3]!
  if (percent >= 70) return EVALUATION_COLUMN_HEADER_TEXT[2]!
  if (percent >= 60) return EVALUATION_COLUMN_HEADER_TEXT[1]!
  return EVALUATION_COLUMN_HEADER_TEXT[0]!
}

/** Cápsula do ícone de pontuação no cartão (contraste com o fundo do cartão). */
export function scorePercentGaugeIconClass(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) {
    return "bg-neutral-grey-100 text-text-secondary dark:bg-neutral-grey-800 dark:text-neutral-grey-300"
  }
  if (percent < 70) {
    return "bg-red-100 text-red-700 dark:bg-red-900/55 dark:text-red-200"
  }
  if (percent < 80) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200"
  }
  if (percent < 90) {
    return "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
  }
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
}

/** Rótulo qualitativo da pontuação global (cartão de resumo, alinhado às faixas de cor). */
export function performanceScoreQualitativeLabel(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) return "—"
  if (percent >= 90) return "Excelente"
  if (percent >= 80) return "Esperado"
  if (percent >= 70) return "Médio"
  if (percent >= 60) return "Básico"
  return "Não atende"
}

/** Fundo da coluna (cabeçalho e células do corpo) — mesma base visual. */
const EVALUATION_COLUMN_BG: string[] = [
  "bg-rose-50/90 dark:bg-rose-950/30",
  "bg-orange-50/95 dark:bg-orange-950/25",
  "bg-amber-50/95 dark:bg-amber-950/25",
  "bg-sky-50/95 dark:bg-sky-950/25",
  "bg-emerald-50/95 dark:bg-emerald-950/25",
]

const EVALUATION_COLUMN_HEADER_TEXT: string[] = [
  "text-rose-700/80 dark:text-rose-200/90",
  "text-orange-800/75 dark:text-orange-200/85",
  "text-amber-800/75 dark:text-amber-100/90",
  "text-sky-800/75 dark:text-sky-100/90",
  "text-emerald-800/75 dark:text-emerald-100/90",
]

/** Célula de corpo: mesmo fundo do cabeçalho da coluna. */
export function evaluationColumnBodyCellClass(colIndex: number): string {
  return EVALUATION_COLUMN_BG[colIndex] ?? "bg-muted/40"
}

/** Célula selecionada (borda + texto do check alinhados à coluna). */
export function evaluationColumnSelectedLabelClass(colIndex: number): string {
  const selected = [
    "border-rose-600 bg-rose-100/80 text-rose-700 ring-2 ring-rose-400/40 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-500/30",
    "border-orange-600 bg-orange-100/80 text-orange-800 ring-2 ring-orange-400/40 dark:border-orange-500 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-500/30",
    "border-amber-600 bg-amber-100/80 text-amber-900 ring-2 ring-amber-400/40 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/30",
    "border-sky-600 bg-sky-100/80 text-sky-800 ring-2 ring-sky-400/40 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-500/30",
    "border-emerald-600 bg-emerald-100/80 text-emerald-800 ring-2 ring-emerald-400/40 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-500/30",
  ]
  return selected[colIndex] ?? "border-brand-primary bg-primary/15 text-brand-primary ring-2 ring-brand-primary/30"
}

/** Cabeçalhos de coluna em tons pastéis (grelha de competências). */
export function columnHeaderToneClass(colIndex: number): string {
  const bg = EVALUATION_COLUMN_BG[colIndex]
  const tx = EVALUATION_COLUMN_HEADER_TEXT[colIndex]
  if (bg && tx) return `${bg} ${tx}`
  return "bg-muted/60 text-muted-foreground"
}

/** Código legível na UI e em PDFs (ex.: AVA-001). */
export function evaluationDisplayCodigo(codigo: number): string {
  const n = Number.isFinite(codigo) && codigo >= 0 ? Math.floor(codigo) : 0
  return `AVA-${String(n).padStart(3, "0")}`
}

/** Percentagem na lista quando ainda não há cálculo gravado (pedido MGR). */
export const AVALIACAO_LIST_PERCENT_FALLBACK = 20

export function avaliacaoListDisplayPercent(pontuacaoPercent: number | null | undefined): number {
  if (pontuacaoPercent == null || Number.isNaN(Number(pontuacaoPercent))) {
    return AVALIACAO_LIST_PERCENT_FALLBACK
  }
  return Number(pontuacaoPercent)
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
