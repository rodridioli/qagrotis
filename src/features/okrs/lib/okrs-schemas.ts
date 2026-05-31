import { z } from "zod"

export const OKR_PERIODOS = ["Q1", "Q2", "Q3", "Q4"] as const
export type OkrPeriodoDto = (typeof OKR_PERIODOS)[number]

export const OKR_SITUACOES = ["ATIVO", "ENCERRADO", "CANCELADO"] as const
export type OkrSituacaoDto = (typeof OKR_SITUACOES)[number]

export const OKR_OBJETIVO_SITUACOES = ["ATIVO", "CANCELADO"] as const
export type OkrObjetivoSituacaoDto = (typeof OKR_OBJETIVO_SITUACOES)[number]

export const OKR_KR_SITUACOES = ["ATIVO", "CANCELADO"] as const
export type OkrKrSituacaoDto = (typeof OKR_KR_SITUACOES)[number]

export const OKR_UNIDADES = [
  "PERCENTUAL",
  "REAL",
  "UNIDADES",
  "HORAS",
  "DIAS",
  "PERSONALIZADA",
] as const
export type OkrUnidadeDto = (typeof OKR_UNIDADES)[number]

export const OKR_INICIATIVA_STATUSES = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const
export type OkrIniciativaStatusDto = (typeof OKR_INICIATIVA_STATUSES)[number]

export const OKR_EQUIPES = ["QA", "UX", "TW", "GESTAO"] as const
export type OkrEquipeDto = (typeof OKR_EQUIPES)[number]

export type OkrRisco = "BAIXO" | "ATENCAO" | "EM_RISCO" | "CRITICO"

// ── Create/Update schemas ─────────────────────────────────────────────────────

export const createOkrSchema = z.object({
  ano: z.number().int().min(2020).max(2100),
  periodo: z.enum(OKR_PERIODOS),
})
export type CreateOkrInput = z.infer<typeof createOkrSchema>

export const updateOkrSituacaoSchema = z.object({
  situacao: z.enum(["ENCERRADO", "CANCELADO"]),
})
export type UpdateOkrSituacaoInput = z.infer<typeof updateOkrSituacaoSchema>

export const createObjetivoSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória").max(500),
  equipes: z.array(z.enum(OKR_EQUIPES)).min(1, "Selecione ao menos uma equipe"),
})
export type CreateObjetivoInput = z.infer<typeof createObjetivoSchema>

export const updateObjetivoSchema = z.object({
  descricao: z.string().min(1).max(500).optional(),
  equipes: z.array(z.enum(OKR_EQUIPES)).min(1).optional(),
})
export type UpdateObjetivoInput = z.infer<typeof updateObjetivoSchema>

export const cancelObjetivoSchema = z.object({
  motivoCancelamento: z.string().min(1, "Motivo é obrigatório").max(1000),
})
export type CancelObjetivoInput = z.infer<typeof cancelObjetivoSchema>

export const createKeyResultSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória").max(500),
  unidade: z.enum(OKR_UNIDADES),
  unidadePersonalizada: z.string().max(50).optional(),
  valorInicial: z.number().min(0),
  meta: z.number().min(0),
  responsaveis: z.array(z.string().min(1)).default([]),
})
export type CreateKeyResultInput = z.infer<typeof createKeyResultSchema>

export const updateKeyResultSchema = createKeyResultSchema.partial()
export type UpdateKeyResultInput = z.infer<typeof updateKeyResultSchema>

export const updateKrValorAtualSchema = z.object({
  valorAtual: z.number().min(0),
})
export type UpdateKrValorAtualInput = z.infer<typeof updateKrValorAtualSchema>

export const cancelKeyResultSchema = z.object({
  motivoCancelamento: z.string().min(1, "Motivo é obrigatório").max(1000),
})
export type CancelKeyResultInput = z.infer<typeof cancelKeyResultSchema>

export const createIniciativaSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória").max(500),
  responsaveis: z.array(z.string().min(1)).default([]),
})
export type CreateIniciativaInput = z.infer<typeof createIniciativaSchema>

export const updateIniciativaSchema = z.object({
  descricao: z.string().min(1).max(500).optional(),
  responsaveis: z.array(z.string().min(1)).optional(),
  status: z.enum(OKR_INICIATIVA_STATUSES).optional(),
})
export type UpdateIniciativaInput = z.infer<typeof updateIniciativaSchema>

// ── DTOs de leitura ───────────────────────────────────────────────────────────

export interface OkrIniciativaResponsavelDto {
  userId: string
  name: string
  photoPath: string | null
}

export interface OkrIniciativaDto {
  id: string
  descricao: string
  status: OkrIniciativaStatusDto
  responsaveis: OkrIniciativaResponsavelDto[]
  createdAt: string
  updatedAt: string
}

export interface OkrKrEvolucaoDto {
  mes: number
  ano: number
  valor: number
}

export interface OkrResponsavelDto {
  userId: string
  name: string
  photoPath: string | null
}

export interface OkrKeyResultDto {
  id: string
  descricao: string
  unidade: OkrUnidadeDto
  unidadePersonalizada: string | null
  valorInicial: number
  valorAtual: number
  meta: number
  situacao: OkrKrSituacaoDto
  motivoCancelamento: string | null
  responsaveis: OkrResponsavelDto[]
  evolucao: OkrKrEvolucaoDto[]
  iniciativas: OkrIniciativaDto[]
  progressoPercent: number
  risco: OkrRisco
  createdAt: string
  updatedAt: string
}

export interface OkrObjetivoDto {
  id: string
  descricao: string
  equipes: OkrEquipeDto[]
  situacao: OkrObjetivoSituacaoDto
  motivoCancelamento: string | null
  percentualConcluido: number
  keyResults: OkrKeyResultDto[]
  createdAt: string
  updatedAt: string
}

export interface OkrDetailDto {
  id: string
  codigo: string
  ano: number
  periodo: OkrPeriodoDto
  situacao: OkrSituacaoDto
  objetivos: OkrObjetivoDto[]
  createdAt: string
  updatedAt: string
}

export interface OkrListRow {
  id: string
  codigo: string
  ano: number
  periodo: OkrPeriodoDto
  situacao: OkrSituacaoDto
  totalObjetivos: number
  objetivosConcluidos: number
  totalKrs: number
  krsConcluidos: number
  updatedAt: string
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const PERIODO_LABELS: Record<OkrPeriodoDto, string> = {
  Q1: "1º Trimestre",
  Q2: "2º Trimestre",
  Q3: "3º Trimestre",
  Q4: "4º Trimestre",
}

export const UNIDADE_LABELS: Record<OkrUnidadeDto, string> = {
  PERCENTUAL: "%",
  REAL: "R$",
  UNIDADES: "Unidades",
  HORAS: "Horas",
  DIAS: "Dias",
  PERSONALIZADA: "Personalizada",
}

export const INICIATIVA_STATUS_LABELS: Record<OkrIniciativaStatusDto, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
}

export const EQUIPE_LABELS: Record<OkrEquipeDto, string> = {
  QA: "QA",
  UX: "UX",
  TW: "TW",
  GESTAO: "MGR",
}

// ── Cálculos de risco ─────────────────────────────────────────────────────────

/** Início e fim (inclusive) de cada trimestre. Mes 1-based. */
const TRIMESTRE_RANGES: Record<OkrPeriodoDto, { startMonth: number; endMonth: number }> = {
  Q1: { startMonth: 1, endMonth: 3 },
  Q2: { startMonth: 4, endMonth: 6 },
  Q3: { startMonth: 7, endMonth: 9 },
  Q4: { startMonth: 10, endMonth: 12 },
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/** % do tempo já transcorrido no trimestre (0–1). */
export function calcularTempoTranscorrido(periodo: OkrPeriodoDto, hoje: Date = new Date()): number {
  const { startMonth, endMonth } = TRIMESTRE_RANGES[periodo]
  const ano = hoje.getFullYear()

  const inicio = new Date(ano, startMonth - 1, 1)

  let totalDias = 0
  for (let m = startMonth; m <= endMonth; m++) {
    totalDias += diasNoMes(ano, m)
  }
  const fim = new Date(ano, endMonth - 1, diasNoMes(ano, endMonth))

  if (hoje < inicio) return 0
  if (hoje > fim) return 1

  const diasTranscorridos = Math.floor((hoje.getTime() - inicio.getTime()) / 86400000)
  return Math.min(diasTranscorridos / totalDias, 1)
}

/** Calcula o risco de um KR com base em progresso vs tempo transcorrido. */
export function calcularRiscoKr(
  valorAtual: number,
  meta: number,
  periodo: OkrPeriodoDto,
  hoje: Date = new Date(),
): OkrRisco {
  if (meta <= 0) return "BAIXO"
  const progressoAtual = Math.min(valorAtual / meta, 1)
  const tempoTranscorrido = calcularTempoTranscorrido(periodo, hoje)

  if (progressoAtual >= 1) return "BAIXO"
  if (tempoTranscorrido <= 0) return "BAIXO"

  const esperado = tempoTranscorrido
  const ratio = progressoAtual / esperado

  if (ratio >= 1) return "BAIXO"
  if (ratio >= 0.8) return "ATENCAO"
  if (ratio >= 0.5) return "EM_RISCO"
  return "CRITICO"
}

/** Calcula o progresso de um objetivo com base nos KRs ativos. */
export function calcularProgressoObjetivo(krs: { valorAtual: number; meta: number; situacao: string }[]): number {
  const ativos = krs.filter((kr) => kr.situacao === "ATIVO" && kr.meta > 0)
  if (ativos.length === 0) return 0
  const soma = ativos.reduce((acc, kr) => acc + Math.min(kr.valorAtual / kr.meta, 1) * 100, 0)
  return soma / ativos.length
}
