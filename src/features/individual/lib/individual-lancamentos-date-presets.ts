/** Presets de intervalo em data civil local (YYYY-MM-DD). */

export type LancamentosPeriodPreset = "today" | "anteriormente" | "week" | "month" | "lastMonth"

export const LANCAMENTOS_PRESET_OPTIONS: { value: LancamentosPeriodPreset; label: string }[] = [
  { value: "today",          label: "Hoje" },
  { value: "anteriormente",  label: "Anteriormente" },
  { value: "week",           label: "Semana" },
  { value: "month",          label: "Mês Atual" },
  { value: "lastMonth",      label: "Mês Anterior" },
]

export function getLancamentosPresetLabel(preset: LancamentosPeriodPreset): string {
  return LANCAMENTOS_PRESET_OPTIONS.find((o) => o.value === preset)?.label ?? "Semana"
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

export function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getLancamentosPresetRange(
  preset: LancamentosPeriodPreset,
  now = new Date(),
): { from: string; to: string } {
  if (preset === "today") {
    const t = toIsoLocal(now)
    return { from: t, to: t }
  }

  if (preset === "anteriormente") {
    // Returns a 14-day window ending yesterday; the component refines to the
    // most-recent day with entries via a second fetch.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const twoWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15)
    return { from: toIsoLocal(twoWeeksAgo), to: toIsoLocal(yesterday) }
  }

  if (preset === "week") {
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
    const todayIso = toIsoLocal(now)
    const weekEndIso = toIsoLocal(sun)
    const to = weekEndIso < todayIso ? weekEndIso : todayIso
    return { from: toIsoLocal(mon), to }
  }

  if (preset === "month") {
    const y = now.getFullYear()
    const m = now.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const todayIso = toIsoLocal(now)
    const lastIso = toIsoLocal(last)
    const to = lastIso < todayIso ? lastIso : todayIso
    return { from: toIsoLocal(first), to }
  }

  const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return { from: toIsoLocal(first), to: toIsoLocal(last) }
}
