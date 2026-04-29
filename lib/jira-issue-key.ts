/**
 * Chave Jira após normalização (projeto em maiúsculas), alinhada à REST API.
 * Ex.: `ux-951` → `UX-951`
 */
export const JIRA_ISSUE_KEY_NORMALIZED_RE = /^[A-Z][A-Z0-9_]+-\d+$/

/**
 * Extrai e normaliza chave de issue a partir de URL completa, caminho ou chave solta.
 * Projeto em qualquer casing; número após o hífen.
 */
export function normalizeJiraIssueKey(input: string): string | null {
  let s = (input ?? "").trim()
  if (!s) return null

  s = s.split("#")[0].trim()
  const q = s.indexOf("?")
  if (q >= 0) s = s.slice(0, q).trim()

  if (s.includes("/")) {
    const parts = s.split("/").filter(Boolean)
    const tail = parts[parts.length - 1]
    if (tail) s = tail
  }

  s = s.split("?")[0].split("#")[0].trim()

  const m = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/.exec(s)
  if (!m) return null

  const normalized = `${m[1].toUpperCase()}-${m[2]}`
  return JIRA_ISSUE_KEY_NORMALIZED_RE.test(normalized) ? normalized : null
}
