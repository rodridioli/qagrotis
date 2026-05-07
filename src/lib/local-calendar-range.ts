/**
 * Limites do **dia civil local** (browser/servidor onde `ref` é construído).
 * Usado no filtro "Hoje" da Equipe (ISO → servidor) e no dashboard (ms).
 */
export function getLocalCalendarDayStartEndMs(ref: Date = new Date()): { startMs: number; endMs: number } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0)
  const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

/** Filtro enviado a `getPerformanceData` — mesmos instantes que `getDateRange` no dashboard. */
export function localDayBoundsToIsoFilter(startMs: number, endMs: number): { dataInicio: string; dataFim: string } {
  return {
    dataInicio: new Date(startMs).toISOString(),
    dataFim: new Date(endMs).toISOString(),
  }
}
