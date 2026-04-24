import type { CenarioRecord, CenarioStep } from "@/lib/actions/cenarios"

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
  /** Passos extraídos de tabela Markdown (aba Teste Automatizado). */
  importSteps: CenarioStep[]
  /** URL do ambiente vinda do markdown (credencial). */
  credencialUrl: string
  credencialUsuario: string
  credencialSenha: string
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

// ─── Parser helpers ───────────────────────────────────────────────────────────

function stripAngleUrl(s: string): string {
  return s.replace(/^<+|>+$/g, "").trim()
}

/** Credencial no topo do .md (Ambiente de QA + Login + Senha). */
export function extractCredentialTripletFromDoc(doc: string): {
  url: string
  usuario: string
  senha: string
} | null {
  const norm = doc.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const pickUrl = (): string => {
    const patterns: RegExp[] = [
      /\*\*Ambiente de QA\*\*\s*:?\s*\n?\s*(https?:\/\/[^\s<>"']+)/i,
      /#{1,4}\s+\*?\*?Ambiente de QA\*?\*?\s*:?\s*\n?\s*(https?:\/\/[^\s<>"']+)/i,
      /^Ambiente de QA\s*:?\s*\n?\s*(https?:\/\/[^\s<>"']+)/im,
    ]
    for (const re of patterns) {
      const m = norm.match(re)
      if (m?.[1]) return stripAngleUrl(m[1])
    }
    return ""
  }
  const pickLogin = (): string => {
    const patterns: RegExp[] = [
      /\*\*Login\*\*\s*:?\s*\n?\s*([^\n]+?)(?=\n#{1,4}|\n\*\*[A-Za-zÀ-ú]|\n\n---|\n*$)/i,
      /#{1,4}\s+\*?\*?Login\*?\*?\s*:?\s*\n?\s*([^\n]+)/i,
      /^Login\s*:?\s*([^\n]+)/im,
    ]
    for (const re of patterns) {
      const m = norm.match(re)
      if (m?.[1]) return m[1].replace(/\*\*/g, "").trim()
    }
    return ""
  }
  const pickSenha = (): string => {
    const patterns: RegExp[] = [
      /\*\*Senha\*\*\s*:?\s*\n?\s*([^\n]+?)(?=\n#{1,4}|\n\*\*[A-Za-zÀ-ú]|\n\n---|\n*$)/i,
      /#{1,4}\s+\*?\*?Senha\*?\*?\s*:?\s*\n?\s*([^\n]+)/i,
      /^Senha\s*:?\s*([^\n]+)/im,
    ]
    for (const re of patterns) {
      const m = norm.match(re)
      if (m?.[1]) return m[1].replace(/\*\*/g, "").trim()
    }
    return ""
  }
  const url = pickUrl()
  const usuario = pickLogin()
  const senha = pickSenha()
  if (url && usuario && senha) return { url, usuario, senha }
  return null
}

/** Interpreta a seção Passos (tabela tipo prompt.md ou linhas soltas). */
export function parsePassosMarkdownToSteps(passosBlock: string, fallbackResultado: string): CenarioStep[] {
  const text = (passosBlock || "").trim()
  if (!text) return []

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const steps: CenarioStep[] = []
  let headerSeen = false

  for (const line of lines) {
    if (!line.includes("|")) continue
    const rawCells = line.split("|").map((c) => c.trim())
    const cells = rawCells.filter((c) => c.length > 0)
    if (cells.length < 2) continue

    const normRow = cells.join(" ").toLowerCase()
    if (/^[-:|.\s]+$/.test(cells.join(""))) continue

    const isHeader =
      (/ação|acao/.test(normRow) && /resultado/.test(normRow)) ||
      (/^\*\*id\*\*$/i.test(cells[0]) && cells.length >= 3)
    if (isHeader) {
      headerSeen = true
      continue
    }

    if (cells.length >= 3) {
      const idCell = cells[0].replace(/\*\*/g, "").trim()
      const looksLikeDataRow = headerSeen || /^\d+$/.test(idCell)
      if (looksLikeDataRow) {
        const acao = cells[1].replace(/\*\*/g, "").trim()
        const resultado = cells.slice(2).join(" | ").replace(/\*\*/g, "").trim()
        if (acao && resultado) steps.push({ acao, resultado })
      }
    }
  }

  if (steps.length > 0) return steps

  const numbered = text.split(/(?=^\d+\.\s+)/m).map((s) => s.trim()).filter(Boolean)
  if (numbered.length > 1 || /^\d+\.\s+/m.test(text)) {
    for (const chunk of numbered) {
      const m = chunk.match(/^\d+\.\s+([\s\S]+)/)
      if (!m) continue
      const body = m[1].trim()
      const parts = body.split(/\n(?=Resultado\s*:|Expected\s*:)/i)
      const acao = (parts[0] || body).trim()
      const resultado =
        parts.length > 1
          ? parts.slice(1).join("\n").replace(/^Resultado\s*:\s*|^Expected\s*:\s*/i, "").trim()
          : (fallbackResultado || "-").trim()
      if (acao) steps.push({ acao, resultado: resultado || (fallbackResultado || "-").trim() })
    }
    if (steps.length > 0) return steps
  }

  if (text.length > 0) {
    steps.push({
      acao: text.slice(0, 4000),
      resultado: (fallbackResultado || "-").trim() || "-",
    })
  }
  return steps
}

function blockHasPassosSection(block: string): boolean {
  return (
    /\*\*Passos\*\*/i.test(block) ||
    /^#{1,4}\s+\*?\*?Passos\*?\*?\s*:?\s*$/im.test(block) ||
    /^#{1,4}\s+\*?\*?Passos\*?\*?\s*:/im.test(block)
  )
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Headings that are FIELD SECTIONS within a scenario, not new scenario boundaries.
 * A H1/H2 that matches this regex should NOT start a new block.
 */
const FIELD_SECTION_RE =
  /^#{1,4}\s+(pré-?condi[çc][oõ]es|pre-?condi[çc][oõ]es|bdd(\s*\(gherkin\))?|gherkin|resultados?\s+esperados?|regra\s+de\s+neg[oó]cio|caminho(\s+da\s+tela)?|descri[çc][aã]o|objetivo|tipo|risco|m[oó]dulo|cliente|steps?|passos?|ambiente(\s+de\s+qa)?|login|senha|usu[aá]rio)\s*$/i

/**
 * Matches a bold-label title line used as a scenario boundary.
 * Supports:
 *   **Cenário:** Title        (colon inside bold, title after)
 *   **Cenário: Title**        (everything inside bold)
 *   **CT-001 — Title**        (numbered, everything inside bold)
 */
const BOLD_TITLE_RE =
  /^\*\*(cenário|título|titulo|ct-?\d*|nome)\s*[:\-–—]\s*\*\*\s*\S|\*\*(cenário|título|titulo|ct-?\d*|nome)\*\*\s*[:\-–—]\s*\S|\*\*(cenário|título|titulo|ct-?\d*|nome)[:\s-–—]+[^*]+\*\*\s*$|^(cenário|título|titulo|nome)\s*:\s*\S/i

/**
 * Parses a markdown string and returns only real scenario blocks.
 *
 * Split strategy:
 *   1. Normalize line endings (\r\n → \n).
 *   2. Split on --- separators (primary boundary between scenarios).
 *   3. Within each --- block, split again at H1/H2 headings that are NOT known
 *      field sections, OR at bold-label title lines (**Cenário:** Title).
 *   4. Headings like ## Pré-condições, ## BDD (Gherkin) stay inside their
 *      scenario block and are handled by getField() as normal field markers.
 */
export function parseMarkdownCenarios(text: string): ParsedCenario[] {
  // Normalize line endings and escaped markdown characters
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\([*#\-`![\](){}|>])/g, "$1")
    // Strip bold markers from field labels so **Descrição:** → Descrição:
    // This handles models that ignore the "no bold" instruction
    .replace(/^\*\*(Cenário|Descrição|Descricao|Regra de neg[oó]cio|Pré-condições|Pre-condicoes|BDD(\s*\(Gherkin\))?|Resultado esperado|Resultados esperados)\*\*\s*:/gim, "$1:")
    .replace(/^\*\*(Cenário|Descrição|Descricao|Regra de neg[oó]cio|Pré-condições|Pre-condicoes|BDD(\s*\(Gherkin\))?|Resultado esperado|Resultados esperados):\s*\*\*/gim, "$1:")
    .replace(
      /^\*\*(Ambiente de QA|Login|Senha|Usuário|Usuario|Passos)\*\*\s*:/gim,
      "$1:",
    )
    .replace(/^\*\*(Ambiente de QA|Login|Senha|Usuário|Usuario|Passos):\s*\*\*/gim, "$1:")

  const globalCredential = extractCredentialTripletFromDoc(normalized)

  // Primary split on --- separators
  const rawBlocks = normalized.split(/\n---+\n?/)

  const blocks: string[] = []

  for (const raw of rawBlocks) {
    const lines = raw.trim().split(/\n/)
    let current = ""

    for (const line of lines) {
      const isH12 = /^#{1,2}\s/.test(line)
      const isBoldTitle = BOLD_TITLE_RE.test(line)
      const isFieldSection = FIELD_SECTION_RE.test(line)

      if ((isH12 || isBoldTitle) && !isFieldSection) {
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
    const lines = trimmed.split(/\n/)

    // ── Name extraction ──────────────────────────────────────────────────────

    let name = ""
    let nameLineIdx = -1

    // 1. First H1/H2 heading — strip CT-NNN prefix (supports -, –, — dashes)
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^#{1,2}\s+(.+)/)
      if (m) {
        name = m[1]
          .replace(/^cenário[:\s]+/i, "")
          .replace(/^ct-?\d+\s*[-–—:]\s*/i, "")
          .trim()
        nameLineIdx = i
        break
      }
    }

    // 2. Fallback: bold label title, e.g. **Cenário:** Title or **Cenário: Title**
    if (!name) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Pattern A: **Label:** Title  (colon inside bold, title after closing **)
        const mA = line.match(/^\*\*(cenário|título|titulo|ct-?\d*|nome)\s*[:\-–—]\s*\*\*\s*(.+)/i)
        // Pattern B: **Label** : Title  (colon/dash outside bold)
        const mB = line.match(/^\*\*(cenário|título|titulo|ct-?\d*|nome)\*\*\s*[:\-–—]\s*(.+)/i)
        // Pattern C: **Label: Title**   (everything inside bold)
        const mC = line.match(/^\*\*(cenário|título|titulo|ct-?\d*|nome)[:\s-–—]+([^*]+)\*\*\s*$/i)
        // Pattern D: Cenário: Title  (plain text, no bold/markdown)
        const mD = !mA && !mB && !mC
          ? line.match(/^(?:cenário|título|titulo|nome)\s*:\s*(.+)/i)
          : null
        const m = mA ?? mB ?? mC ?? mD
        if (m) {
          name = (m[2] ?? m[1]).replace(/^ct-?\d+\s*[-–—:]\s*/i, "").trim()
          nameLineIdx = i
          break
        }
      }
    }

    if (!name) continue

    // ── Field helpers ────────────────────────────────────────────────────────

    function isHeader(line: string): boolean {
      // Standalone bold header: **Field:** or **Field**: or **Field**
      if (/^\s*\*\*[^*\n]+\*\*\s*:?\s*$/.test(line)) return true
      // H1-H4 headings
      if (/^#{1,4}\s/.test(line)) return true
      // Inline bold label on same line: **Field:** value or **Field**: value
      if (/^\s*\*\*(?:cenário|título|titulo|descri[çc][aã]o|descricao|regra\s+de\s+neg[oó]cio|m[oó]dulo|cliente|risco|tipo)[:\s]+\*\*\s*\S/.test(line)) return true
      if (/^\s*\*\*(?:cenário|título|titulo|descri[çc][aã]o|descricao|regra\s+de\s+neg[oó]cio|m[oó]dulo|cliente|risco|tipo)\*\*[:\s]+\S/.test(line)) return true
      if (/^\s*\*\*(?:ambiente de qa|login|senha|usu[aá]rio|passos)\*\*\s*:?\s*$/i.test(line)) return true
      if (/^\s*\*\*(?:ambiente de qa|login|senha|usu[aá]rio|passos)\s*:\s*[^*]+\*\*\s*$/i.test(line)) return true
      // Plain text label: "Descrição: value" or "Pré-condições:" or "BDD (Gherkin):" etc.
      if (/^(?:cenário|descrição|descricao|regra\s+de\s+neg[oó]cio|pré-condições|pre-condicoes|bdd(?:\s*\(gherkin\))?|resultado\s+esperado|resultados?\s+esperados?|ambiente de qa|login|senha|usu[aá]rio|passos)\s*:/i.test(line)) return true
      return false
    }

    // Find the first field header line after the title line
    let firstHeaderIdx = lines.length
    for (let i = nameLineIdx + 1; i < lines.length; i++) {
      if (isHeader(lines[i])) {
        firstHeaderIdx = i
        break
      }
    }

    // Plain paragraph(s) between title and first field header → description fallback
    const descriptionFallback = lines
      .slice(nameLineIdx + 1, firstHeaderIdx)
      .filter(l => l.trim())
      .join("\n")
      .trim()

    function getField(keys: string[]): string {
      const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      const kp = esc.join("|")
      // **Field:** value  — colon inside bold, value inline
      const reSameLine  = new RegExp(`^\\s*\\*\\*(${kp})[:\\s]+\\*\\*\\s*(\\S.*)$`, "i")
      // **Field**: value  — colon outside bold, value inline
      const reSameLine2 = new RegExp(`^\\s*\\*\\*(${kp})\\*\\*[:\\s]+(\\S.*)$`, "i")
      // **Field:**  alone — colon inside bold, block below
      const reHeader    = new RegExp(`^\\s*\\*\\*(${kp})[:\\s]*\\*\\*\\s*$`, "i")
      // **Field**:  alone — colon outside bold, block below
      const reHeaderExt = new RegExp(`^\\s*\\*\\*(${kp})\\*\\*\\s*:\\s*$`, "i")
      const reHeading   = new RegExp(`^#{2,4}\\s+(${kp})\\s*$`, "i")
      // Plain text inline: "Field: value"  (no bold, no heading)
      const rePlainInline = new RegExp(`^\\s*(${kp})\\s*:\\s*(\\S.*)$`, "i")
      // Plain text block: "Field:" alone, content on following lines
      const rePlainBlock  = new RegExp(`^\\s*(${kp})\\s*:\\s*$`, "i")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = line.match(reSameLine) ?? line.match(reSameLine2)
        if (m) return (m[2] ?? "").trim()
        if (reHeader.test(line) || reHeaderExt.test(line) || reHeading.test(line)) {
          const buf: string[] = []
          for (let j = i + 1; j < lines.length; j++) {
            if (isHeader(lines[j])) break
            buf.push(lines[j])
          }
          return buf.join("\n").trim()
        }
        // Plain text inline match
        const mPlain = line.match(rePlainInline)
        if (mPlain) return (mPlain[2] ?? "").trim()
        // Plain text block match
        if (rePlainBlock.test(line)) {
          const buf: string[] = []
          for (let j = i + 1; j < lines.length; j++) {
            if (isHeader(lines[j])) break
            buf.push(lines[j])
          }
          return buf.join("\n").trim()
        }
      }
      return ""
    }

    const tipoRaw = getField(["tipo", "type"])
    const tipoFromLabel: "Manual" | "Automatizado" | "Man./Auto." =
      /man.*auto|auto.*man/i.test(tipoRaw) ? "Man./Auto." :
      /auto/i.test(tipoRaw) ? "Automatizado" : "Manual"

    const passosText = getField(["passos", "steps", "step"])
    const hasPassos = blockHasPassosSection(trimmed)
    const resultadoEsperadoField = getField([
      "resultados esperados",
      "resultado esperado",
      "resultado esperado:",
      "resultados",
      "resultado",
      "expected result",
      "expected results",
    ])
    const bddField = getField(["bdd (gherkin)", "bdd", "gherkin"])

    const importSteps = parsePassosMarkdownToSteps(passosText, resultadoEsperadoField)

    let tipo: "Manual" | "Automatizado" | "Man./Auto."
    if (hasPassos) {
      tipo = "Automatizado"
    } else if (bddField.trim()) {
      tipo = "Manual"
    } else {
      tipo = tipoFromLabel
    }

    const credUrlBlock = getField([
      "ambiente de qa",
      "ambiente de QA",
      "url do ambiente",
      "ambiente",
      "environment",
    ])
    const credUserBlock = getField(["login", "usuário", "usuario", "usuário de qa", "user"])
    const credSenhaBlock = getField(["senha", "password"])
    const credencialUrl = stripAngleUrl(credUrlBlock.trim()) || (globalCredential?.url ?? "")
    const credencialUsuario = credUserBlock.trim() || (globalCredential?.usuario ?? "")
    const credencialSenha = credSenhaBlock.trim() || (globalCredential?.senha ?? "")

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
      // Use labeled **Descrição:** if present; otherwise first plain paragraph after title
      descricao:         getField(["descrição", "descricao", "description", "description:", "objetivo", "descr"]) || descriptionFallback,
      caminhoTela:       getField(["caminho da tela", "caminho", "screen path", "path"]),
      regraDeNegocio:    getField(["regra de negócio", "regra de negocio", "regra", "business rule"]),
      preCondicoes:      getField(["pré-condições", "pré condições", "pre-condições", "pre-condicoes", "preconditions"]),
      // Removed "cenário"/"cenario"/"scenario" to avoid collision with title labels
      bdd:               bddField,
      resultadoEsperado: resultadoEsperadoField,
      importSteps,
      credencialUrl,
      credencialUsuario,
      credencialSenha,
    })
  }

  return results
}

/** Normalize a string for duplicate comparison */
export function normalizeName(s: string): string {
  return s.toLowerCase().trim()
}

/** Build ImportItems from parsed cenarios + existing records.
 *  If the AI-generated cenário already has a `module` that matches one of the
 *  system's valid module names (case-insensitive), it is preserved.
 *  Otherwise the user-selected `defaultModule` is used.
 */
export function buildImportItems(
  parsed: ParsedCenario[],
  defaultModule: string,
  existingCenarios: CenarioRecord[],
  validModuleNames: string[] = [],
): ImportItem[] {
  const normalizedValid = validModuleNames.map((m) => m.toLowerCase().trim())

  return parsed.map((p, idx) => {
    // Determine the best module: AI-detected (if valid) → user-selected default
    let resolvedModule = defaultModule
    if (p.module && p.module !== "Não informado") {
      const aiModuleLower = p.module.toLowerCase().trim()
      const matchIdx = normalizedValid.findIndex((m) => m === aiModuleLower)
      if (matchIdx >= 0) {
        // Use the original casing from validModuleNames
        resolvedModule = validModuleNames[matchIdx]
      }
    }

    const pFinal: ParsedCenario = { ...p, module: resolvedModule }
    const existing =
      existingCenarios.find(
        (c) => c.active && normalizeName(c.scenarioName) === normalizeName(p.scenarioName)
      ) ?? null

    let error: string | undefined
    if (!pFinal.scenarioName?.trim()) {
      error = "Cenário sem título: não foi possível identificar o nome no texto."
    }
    // Com título identificado, não bloqueia por corpo vazio (evita "nenhum campo identificado" em .md do gerador)

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
