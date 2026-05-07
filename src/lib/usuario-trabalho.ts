/** Modalidade de trabalho (cadastro de usuário). */
export const FORMATOS_TRABALHO = ["Presencial", "Híbrido", "Remoto"] as const
export type FormatoTrabalho = (typeof FORMATOS_TRABALHO)[number]

/** Ids estáveis para persistência (ordem: segunda → domingo). */
export const HIBRIDO_DIA_IDS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const
export type DiaSemanaHibridoId = (typeof HIBRIDO_DIA_IDS)[number]

export const HIBRIDO_DIA_LABELS: Record<DiaSemanaHibridoId, string> = {
  seg: "Seg.",
  ter: "Ter.",
  qua: "Qua.",
  qui: "Qui.",
  sex: "Sex.",
  sab: "Sáb.",
  dom: "Dom.",
}

export function sanitizeFormatoTrabalho(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const v = value.trim()
  return (FORMATOS_TRABALHO as readonly string[]).includes(v) ? v : null
}

const allowedDiaSet = new Set<string>(HIBRIDO_DIA_IDS)

/**
 * Complemento na semana (dias não incluídos em `ids`), ordem seg→dom.
 * Útil para derivar dias presenciais a partir dos dias não presenciais gravados.
 */
export function complementDiasHibrido(ids: readonly DiaSemanaHibridoId[]): DiaSemanaHibridoId[] {
  const s = new Set(ids)
  return HIBRIDO_DIA_IDS.filter((d) => !s.has(d))
}

/** Rótulos curtos para tooltip/lista (ex.: equipe). */
export function labelsDiasHibrido(ids: readonly DiaSemanaHibridoId[]): string {
  return ids.map((id) => HIBRIDO_DIA_LABELS[id]).join(", ")
}

/**
 * `diasTrabalhoHibrido` no banco = dias em que a pessoa **não** trabalha presencialmente
 * (fora do escritório no modelo híbrido). No formulário, os checkboxes marcam exatamente isso.
 */
export function normalizeDiasTrabalhoHibrido(input: unknown): DiaSemanaHibridoId[] {
  if (!Array.isArray(input)) return []
  const picked = new Set<string>()
  for (const x of input) {
    const id = typeof x === "string" ? x.trim() : ""
    if (allowedDiaSet.has(id)) picked.add(id)
  }
  return HIBRIDO_DIA_IDS.filter((id) => picked.has(id))
}

/**
 * Valor para persistência: só grava quando formato é Híbrido; caso contrário limpa (`null`).
 * Grava dias **fora** do escritório (não presenciais).
 */
export function diasTrabalhoHibridoForStorage(
  formatoTrabalho: string | null | undefined,
  diasInput: unknown,
): string[] | null {
  if (sanitizeFormatoTrabalho(formatoTrabalho) !== "Híbrido") return null
  const normalized = normalizeDiasTrabalhoHibrido(diasInput)
  return normalized.length > 0 ? [...normalized] : null
}

/** Aceita valor de `<input type="time">` (HH:MM) ou vazio → null. */
export function parseHorarioInput(value: string | null | undefined): string | null {
  const t = value?.trim()
  if (!t) return null
  if (!/^\d{2}:\d{2}$/.test(t)) return null
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10))
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}
