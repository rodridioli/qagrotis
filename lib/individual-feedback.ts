/** Constants, types and utilities for the Individual Feedback module (server-safe, no "use server"). */

export const FEEDBACK_TIPO_SLUGS = [
  "POSITIVO",
  "DESENVOLVIMENTO",
  "CORRETIVO",
  "FORMAL_CICLO",
  "TREZENTOS_SESSENTA",
] as const

export type FeedbackTipoSlug = (typeof FEEDBACK_TIPO_SLUGS)[number]

export const FEEDBACK_TIPO_LABELS: Record<FeedbackTipoSlug, string> = {
  POSITIVO: "Positivo",
  DESENVOLVIMENTO: "Desenvolvimento",
  CORRETIVO: "Corretivo",
  FORMAL_CICLO: "Formal (ciclo)",
  TREZENTOS_SESSENTA: "360°",
}

export function isFeedbackTipoSlug(v: string): v is FeedbackTipoSlug {
  return (FEEDBACK_TIPO_SLUGS as readonly string[]).includes(v)
}

export function feedbackTipoLabel(tipo: string): string {
  return isFeedbackTipoSlug(tipo) ? FEEDBACK_TIPO_LABELS[tipo] : tipo
}

export function feedbackDisplayCodigo(codigo: number): string {
  return `FED-${String(codigo).padStart(3, "0")}`
}

// ── Campos interfaces ─────────────────────────────────────────────────────────

export interface FeedbackCamposPositivo {
  contexto: string
  feedback: string
  impacto: string
}

export interface FeedbackCamposDesenvolvimento {
  contexto: string
  feedback: string
  impacto: string
  sugestao: string
}

export interface FeedbackCamposCorretivo {
  contexto: string
  feedback: string
  impacto: string
  acaoEsperada: string
}

export interface FeedbackCamposFormalCiclo {
  pontosPositivos: string
  pontosMelhoria: string
  avaliacaoGeral: string
  proximosPassos: string
}

export interface FeedbackCamposTrezentosSessenta {
  contexto: string
  percepcaoPares: string
  percepcaoLider: string
  resumo: string
}

export type FeedbackCampos =
  | FeedbackCamposPositivo
  | FeedbackCamposDesenvolvimento
  | FeedbackCamposCorretivo
  | FeedbackCamposFormalCiclo
  | FeedbackCamposTrezentosSessenta

// ── DTOs ──────────────────────────────────────────────────────────────────────

export type IndividualFeedbackStatusDto = "RASCUNHO" | "CONCLUIDA"

export interface IndividualFeedbackListRow {
  id: string
  codigo: number
  /** ISO yyyy-mm-dd (data de atualização). */
  dataYmd: string
  tipo: FeedbackTipoSlug
  status: IndividualFeedbackStatusDto
}

export interface IndividualFeedbackDetail {
  id: string
  evaluatedUserId: string
  codigo: number
  tipo: FeedbackTipoSlug
  status: IndividualFeedbackStatusDto
  campos: FeedbackCampos
  dataYmd: string
}
