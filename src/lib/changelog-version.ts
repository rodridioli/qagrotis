/**
 * Normaliza versão semântica para exibição no changelog:
 * - patch > 9 acarreta minor (ex.: 1.6.10 → 1.7.0)
 * - minor > 9 acarreta major
 * - 1.9.9 → 2.0.0
 */
export function formatChangelogVersionForDisplay(raw: string): string {
  const m = raw.trim().replace(/^v/i, "")
  const parts = m.split(".").map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return raw

  let a = parts[0]!
  let b = parts[1]!
  let c = parts[2]!

  while (c > 9) {
    c -= 10
    b += 1
  }
  while (b > 9) {
    b -= 10
    a += 1
  }

  if (b === 9 && c === 9) {
    return `${a + 1}.0.0`
  }

  return `${a}.${b}.${c}`
}
