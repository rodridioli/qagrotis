/**
 * Nome de ficheiro .md a partir do nome da suíte: sem acentos, espaços → `-`,
 * remove caracteres inválidos em caminhos comuns.
 */
export function sanitizeSuiteMarkdownBaseName(raw: string, fallback: string): string {
  const base = (raw.trim() || fallback.trim() || "suite")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
  return base || "suite"
}

export function suiteMarkdownDownloadFilename(suiteName: string, fallbackId?: string): string {
  const fb = (fallbackId ?? "").trim() || "suite"
  const slug = sanitizeSuiteMarkdownBaseName(suiteName, fb)
  return `${slug}.md`
}

export function downloadMarkdownFile(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
