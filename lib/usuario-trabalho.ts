/** Modalidade de trabalho (cadastro de usuário). */
export const FORMATOS_TRABALHO = ["Presencial", "Híbrido", "Remoto"] as const
export type FormatoTrabalho = (typeof FORMATOS_TRABALHO)[number]

export function sanitizeFormatoTrabalho(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const v = value.trim()
  return (FORMATOS_TRABALHO as readonly string[]).includes(v) ? v : null
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
