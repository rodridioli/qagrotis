import type { CenarioRecord } from "@/lib/actions/cenarios"

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ParsedCenario {
  scenarioName: string
  module: string
  client: string
  risco: string
  tipo: "Manual" | "Automatizado" | "Man./Auto."
  descricao: string
  caminhoTela: string
  regraDeNegocio: string
  preCondicoes: string
  bdd: string
  resultadoEsperado: string
}

export interface ImportItem {
  key: string
  parsed: ParsedCenario
  existing: CenarioRecord | null
  include: boolean
  replace: boolean
  error?: string
}

export const COMPARE_FIELDS: Array<{
  label: string
  pKey: keyof ParsedCenario
  eKey: keyof CenarioRecord
}> = [
  { label: "Módulo",             pKey: "module",            eKey: "module" },
  { label: "Cliente",            pKey: "client",            eKey: "client" },
  { label: "Risco",              pKey: "risco",             eKey: "risco" },
  { label: "Tipo",               pKey: "tipo",              eKey: "tipo" },
  { label: "Descrição",          pKey: "descricao",         eKey: "descricao" },
  { label: "Caminho da Tela",    pKey: "caminhoTela",       eKey: "caminhoTela" },
  { label: "Regra de Negócio",   pKey: "regraDeNegocio",    eKey: "regraDeNegocio" },
  { label: "Pré-condições",      pKey: "preCondicoes",      eKey: "preCondicoes" },
  { label: "BDD (Gherkin)",      pKey: "bdd",               eKey: "bdd" },
  { label: "Resultado Esperado", pKey: "resultadoEsperado", eKey: "resultadoEsperado" },
]

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Headings that are FIELD SECTIONS within a scenario, not new scenario boundaries.
 * A H1/H2 that matches this regex should NOT start a new block.
 */
const FIELD_SECTION_RE =
  /^#{1,4}\s+(pré-?condi[çc][oõ]es|pre-?condi[çc][oõ]es|bdd(\s*\(gherkin\))?|gherkin|resultados?\s+esperados?|regra\s+de\s+neg[oó]cio|caminho(\s+da\s+tela)?|descri[çc][aã]o|objetivo|tipo|risco|m[oó]dulo|cliente|steps?|passos?)\s*$/i

/**
 * Parses a markdown string and returns only real scenario blocks.
 *
 * Split strategy:
 *   1. Split on --- separators (primary boundary between scenarios).
 *   2. Within each --- block, split again at H1/H2 headings that are NOT known
 *      field sections (Pré-condições, BDD, Resultado esperado, etc.).
 *      This supports files where multiple scenarios share a block without ---.
 *   3. Headings like ## Pré-condições, ## BDD (Gherkin) stay inside their
 *      scenario block and are handled by getField() as normal field markers.
 */
export function parseMarkdownCenarios(text: string): ParsedCenario[] {
  // Normalize escaped markdown characters
  const normalized = text.replace(/\\([*#\-`![\](){}|>])/g, "$1")

  // Primary split on --- separators
  const rawBlocks = normalized.split(/\n---+\n?/)

  const blocks: string[] = []

  for (const raw of rawBlocks) {
    // Within each --- block, split only at H1/H2 that are NOT field sections.
    // This allows multi-scenario blocks while keeping section headers in-place.
    const lines = raw.trim().split(/\r?\n/)
    let current = ""

    for (const line of lines) {
      const isH12 = /^#{1,2}\s/.test(line)
      const isFieldSection = FIELD_SECTION_RE.test(line)

      if (isH12 && !isFieldSection) {
        // Start of a new scenario block
        if (current.trim()) blocks.push(current.trim())
        current = line
      } else {
        current = current ? current + "\n" + line : line
      }
    }

    if (current.trim()) blocks.push(current.trim())
  }

  const results: ParsedCenario[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const lines = trimmed.split(/\r?\n/)

    // Name from first H1/H2 heading — strip CT-NNN prefix
    let name = ""
    for (const line of lines) {
      const m = line.match(/^#{1,2}\s+(.+)/)
      if (m) {
        name = m[1]
          .replace(/^cenário:\s*/i, "")
          .replace(/^ct-?\d+\s*[-–:]\s*/i, "")
          .trim()
        break
      }
    }
    if (!name) continue

    // A standalone **Label:** line ends right after the closing **
    function isHeader(line: string): boolean {
      return /^\s*\*\*[^*\n]+\*\*\s*:?\s*$/.test(line) || /^#{1,4}\s/.test(line)
    }

    function getField(keys: string[]): string {
      const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      const kp = esc.join("|")
      const reSameLine  = new RegExp(`^\\s*\\*\\*(${kp})[:\\s]+\\*\\*\\s*(\\S.*)$`, "i")
      const reSameLine2 = new RegExp(`^\\s*\\*\\*(${kp})\\*\\*[:\\s]+(\\S.*)$`, "i")
      const reHeader    = new RegExp(`^\\s*\\*\\*(${kp})[:\\s]*\\*\\*\\s*$`, "i")
      const reHeading   = new RegExp(`^#{2,4}\\s+(${kp})\\s*$`, "i")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = line.match(reSameLine) ?? line.match(reSameLine2)
        if (m) return (m[2] ?? "").trim()
        if (reHeader.test(line) || reHeading.test(line)) {
          const buf: string[] = []
          for (let j = i + 1; j < lines.length; j++) {
            if (isHeader(lines[j])) break
            buf.push(lines[j])
          }
          return buf.filter((l) => l.trim()).join(" ").trim()
        }
      }
      return ""
    }

    const tipoRaw = getField(["tipo", "type"])
    const tipo: "Manual" | "Automatizado" | "Man./Auto." =
      /man.*auto|auto.*man/i.test(tipoRaw) ? "Man./Auto." :
      /auto/i.test(tipoRaw) ? "Automatizado" : "Manual"

    const riscoRaw = getField(["risco", "risk", "prioridade", "priority"])
    const risco =
      /alto|high/i.test(riscoRaw) ? "Alto" :
      /baixo|low/i.test(riscoRaw) ? "Baixo" : "Médio"

    results.push({
      scenarioName:      name,
      module:            getField(["módulo", "modulo", "module"]),
      client:            getField(["cliente", "client"]),
      risco,
      tipo,
      descricao:         getField(["descrição", "descricao", "description", "objetivo"]),
      caminhoTela:       getField(["caminho da tela", "caminho", "screen path", "path"]),
      regraDeNegocio:    getField(["regra de negócio", "regra de negocio", "regra", "business rule"]),
      preCondicoes:      getField(["pré-condições", "pré condições", "pre-condições", "pre-condicoes", "preconditions"]),
      bdd:               getField(["cenário", "cenario", "bdd (gherkin)", "bdd", "gherkin", "scenario"]),
      resultadoEsperado: getField(["resultados esperados", "resultado esperado", "resultado", "resultados", "expected result"]),
    })
  }

  return results
}

/** Normalize a string for duplicate comparison */
export function normalizeName(s: string): string {
  return s.toLowerCase().trim()
}

/** Build ImportItems from parsed cenarios + existing records */
export function buildImportItems(
  parsed: ParsedCenario[],
  module: string,
  existingCenarios: CenarioRecord[]
): ImportItem[] {
  return parsed.map((p, idx) => {
    const pFinal: ParsedCenario = { ...p, module }
    const existing =
      existingCenarios.find(
        (c) => c.active && normalizeName(c.scenarioName) === normalizeName(p.scenarioName)
      ) ?? null

    let error: string | undefined
    if (!pFinal.descricao && !pFinal.bdd && !pFinal.regraDeNegocio) {
      error = "Nenhum conteúdo descritivo encontrado no arquivo"
    }

    return {
      key: `${idx}-${p.scenarioName}`,
      parsed: pFinal,
      existing,
      include: !error,
      replace: false,
      error,
    }
  })
}
