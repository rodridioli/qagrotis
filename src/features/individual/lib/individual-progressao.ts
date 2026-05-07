export type ProgressaoTipo = "ADMISSAO" | "DISSIDIO" | "PROMOCAO" | "MERITO"
export type ProgressaoRegime = "CLT" | "PJ" | "COOPERADO"

export interface ProgressaoListRow {
  id: string
  codigo: number
  dataYmd: string
  tipo: ProgressaoTipo
  regime: ProgressaoRegime
  cargo: string
  valor: number // centavos
}

export const PROGRESSAO_TIPO_OPTIONS: { value: ProgressaoTipo; label: string }[] = [
  { value: "ADMISSAO", label: "Admissão" },
  { value: "DISSIDIO", label: "Dissídio" },
  { value: "PROMOCAO", label: "Promoção" },
  { value: "MERITO",   label: "Mérito"   },
]

export const PROGRESSAO_REGIME_OPTIONS: { value: ProgressaoRegime; label: string }[] = [
  { value: "CLT",       label: "CLT"       },
  { value: "PJ",        label: "PJ"        },
  { value: "COOPERADO", label: "Cooperado" },
]

const TIPO_LABELS: Record<ProgressaoTipo, string> = {
  ADMISSAO: "Admissão",
  DISSIDIO: "Dissídio",
  PROMOCAO: "Promoção",
  MERITO:   "Mérito",
}

const REGIME_LABELS: Record<ProgressaoRegime, string> = {
  CLT:       "CLT",
  PJ:        "PJ",
  COOPERADO: "Cooperado",
}

export function progressaoDisplayCodigo(codigo: number): string {
  return `PGS-${String(codigo).padStart(3, "0")}`
}

export function progressaoTipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo as ProgressaoTipo] ?? tipo
}

export function progressaoRegimeLabel(regime: string): string {
  return REGIME_LABELS[regime as ProgressaoRegime] ?? regime
}

export function formatValorBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
