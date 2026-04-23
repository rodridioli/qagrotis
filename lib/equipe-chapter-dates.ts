/** Fuso usado para “hoje”, quintas-feiras e comparação de datas civis (BR). */
export const CHAPTER_TZ = "America/Sao_Paulo"

/** `yyyy-mm-dd` da data civil em `timeZone`. */
export function formatYmdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** Meia-noite UTC do dia civil `yyyy-mm-dd` (armazenamento estável). */
export function parseYmdToDbDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  if (!y || mo < 1 || mo > 12 || da < 1 || da > 31) return null
  return new Date(Date.UTC(y, mo - 1, da, 0, 0, 0, 0))
}

export function ymdFromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Quinta-feira no calendário de `America/Sao_Paulo` para o dia civil `ymd`. */
export function isThursdayYmdBrazil(ymd: string): boolean {
  const d = parseYmdToDbDate(ymd)
  if (!d) return false
  const inst = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 15, 0, 0, 0))
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: CHAPTER_TZ,
    weekday: "long",
  }).formatToParts(inst)
  const label = wd.find((p) => p.type === "weekday")?.value
  return label === "Thursday"
}

export function todayYmdBrazil(now: Date = new Date()): string {
  return formatYmdInTz(now, CHAPTER_TZ)
}

/** `yyyy-mm-dd` que corresponde a um dia civil existente (round-trip com armazenamento UTC meia-noite). */
export function isValidCalendarYmd(ymd: string): boolean {
  const t = ymd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const d = parseYmdToDbDate(t)
  if (!d) return false
  return ymdFromDbDate(d) === t
}

/** Novo chapter: qualquer data civil válida. */
export function isValidNewChapterDate(ymd: string, _now: Date = new Date()): boolean {
  return isValidCalendarYmd(ymd)
}

/** Edição: qualquer data civil válida. */
export function isValidUpdatedChapterDate(
  ymd: string,
  _previousYmd: string,
  _now: Date = new Date(),
): boolean {
  return isValidCalendarYmd(ymd)
}

/**
 * Quintas-feiras a partir de hoje (inclusive) em SP, até `maxCount` datas.
 * `includeYmd` inclui a data atual do registro na lista (ex.: chapter no passado).
 */
export function listThursdayYmOptions(
  now: Date,
  opts: { maxCount: number; includeYmd?: string | null },
): string[] {
  const today = todayYmdBrazil(now)
  const found: string[] = []
  let cursor = new Date(now.getTime())
  for (let i = 0; i < 800 && found.length < opts.maxCount; i++) {
    const ymd = formatYmdInTz(cursor, CHAPTER_TZ)
    if (isThursdayYmdBrazil(ymd) && ymd >= today) found.push(ymd)
    cursor = new Date(cursor.getTime() + 86400000)
  }
  const inc = opts.includeYmd?.trim()
  if (inc && isThursdayYmdBrazil(inc) && !found.includes(inc)) {
    return [...found, inc].sort()
  }
  return found
}

/** Rótulo curto para select (ex.: 28/05/2026). */
export function formatChapterDateLabelPt(ymd: string): string {
  const d = parseYmdToDbDate(ymd)
  if (!d) return ymd
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}
