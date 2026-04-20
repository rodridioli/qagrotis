/**
 * Executa vários loaders em paralelo com allSettled.
 * Falhas individuais usam o fallback e são logadas — a página continua renderizando.
 */
export async function loadParallelOrFallback<T extends Record<string, unknown>>(
  label: string,
  loaders: { [K in keyof T]: () => Promise<T[K]> },
  fallbacks: T,
): Promise<T> {
  const keys = Object.keys(loaders) as (keyof T)[]
  const results = await Promise.allSettled(keys.map((k) => loaders[k]()))
  const out: T = { ...fallbacks }
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const r = results[i]
    if (r.status === "fulfilled") {
      out[k] = r.value
    } else {
      console.error(`[${label}] ${String(k)}:`, r.reason)
    }
  }
  return out
}
