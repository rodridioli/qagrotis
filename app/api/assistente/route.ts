import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { getIntegracoes } from "@/lib/actions/integracoes"

// ── GitBook content cache ─────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const GITBOOK_ORG_ID = process.env.GITBOOK_ORG_ID ?? "YJL6kpwzoMMhtvwRrmNt"
const GITBOOK_SITE_ID = process.env.GITBOOK_SITE_ID ?? "site_YbjJD"
const GITBOOK_SPACE_ID = process.env.GITBOOK_SPACE_ID ?? ""
const GITBOOK_API_TOKEN = process.env.GITBOOK_API_TOKEN ?? ""

let cachedContent: string | null = null
let cacheExpiry = 0

async function fetchGitBookContent(): Promise<string> {
  const now = Date.now()
  if (cachedContent && now < cacheExpiry) return cachedContent

  if (!GITBOOK_API_TOKEN) {
    throw new Error("Configure GITBOOK_API_TOKEN nas variáveis de ambiente do Vercel.")
  }

  const headers = { "Authorization": `Bearer ${GITBOOK_API_TOKEN}` }

  // Resolve spaceId: use env var if set, otherwise discover from org + site
  let spaceId = GITBOOK_SPACE_ID
  if (!spaceId) {
    // Get the first space associated with the site
    const siteRes = await fetch(
      `https://api.gitbook.com/v1/orgs/${GITBOOK_ORG_ID}/sites/${GITBOOK_SITE_ID}/site-spaces`,
      { headers }
    )
    if (!siteRes.ok) {
      const err = await siteRes.text()
      throw new Error(`GitBook site-spaces error: ${siteRes.status} — ${err.slice(0, 200)}`)
    }
    const siteData = await siteRes.json() as { items?: { space: { id: string } }[] }
    spaceId = siteData.items?.[0]?.space?.id ?? ""
    if (!spaceId) throw new Error("Não foi possível encontrar o Space ID via API do GitBook.")
  }

  // List all pages in the space
  const pagesRes = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, { headers })
  if (!pagesRes.ok) {
    const err = await pagesRes.text()
    throw new Error(`GitBook content error: ${pagesRes.status} — ${err.slice(0, 200)}`)
  }

  const data = await pagesRes.json() as { pages?: { id: string; title: string; path: string; type: string }[] }
  const pages = (data.pages ?? []).filter((p) => p.type === "document")
  if (pages.length === 0) throw new Error("Nenhuma página encontrada no espaço GitBook.")

  // Fetch markdown content of each page (up to 30)
  const contents: string[] = []
  for (const page of pages.slice(0, 30)) {
    try {
      const pageRes = await fetch(
        `https://api.gitbook.com/v1/spaces/${spaceId}/content/path/${encodeURIComponent(page.path)}`,
        { headers }
      )
      if (!pageRes.ok) continue
      const pageData = await pageRes.json() as { markdown?: string }
      if (pageData.markdown) contents.push(`# ${page.title}

${pageData.markdown}`)
    } catch { /* skip failed pages */ }
  }

  cachedContent = contents.join("

---

") || "Documentação ainda não indexada."
  cacheExpiry = now + CACHE_TTL_MS
  return cachedContent
}

// ── Keyword-based retrieval (RAG sem embeddings) ──────────────────────────────

function findRelevantSections(content: string, query: string, sistema: string): string {
  const stopWords = new Set([
    "o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das",
    "em", "no", "na", "nos", "nas", "para", "por", "com", "que", "se",
    "e", "ou", "the", "is", "in", "of", "to", "a", "and", "for",
  ])

  const keywords = [
    ...query.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w)),
    ...sistema.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  ]

  if (keywords.length === 0) return content.slice(0, 6000)

  const lines = content.split("\n")

  // Score each line
  const scored = lines.map((line, i) => {
    const lower = line.toLowerCase()
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
    return { score, i }
  })

  // Collect indices of high-score lines + surrounding context
  const relevant = new Set<number>()
  for (const { score, i } of scored) {
    if (score > 0) {
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 12); j++) {
        relevant.add(j)
      }
    }
  }

  if (relevant.size === 0) {
    // Fallback: first chunk of the document
    return lines.slice(0, 120).join("\n")
  }

  const sections = [...relevant]
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .join("\n")

  // Cap at ~8000 chars to stay within token budget
  return sections.length > 8000 ? sections.slice(0, 8000) : sections
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente de suporte técnico especializado na documentação do sistema Agrotis.

## Diretrizes de comportamento
- Responda SOMENTE com base no conteúdo da documentação fornecida abaixo
- Use linguagem clara, objetiva e amigável (pt-BR)
- Se a pergunta não puder ser respondida com o conteúdo disponível, responda: "Não encontrei informações sobre isso na documentação disponível. Tente reformular sua pergunta ou entre em contato com o suporte técnico."
- Nunca invente informações que não estão na documentação
- Use formatação Markdown quando ajudar na clareza (listas, negrito, blocos de código)
- Seja conciso mas completo — evite respostas genéricas

## Sistema selecionado
O usuário está trabalhando no módulo: **{sistema}**
Priorize conteúdo relacionado a este módulo quando relevante.

## Documentação de referência
{contexto}`

// ── Provider call (mirrors gerador/route.ts patterns) ────────────────────────

async function callProvider(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<Response> {
  switch (provider) {
    case "anthropic": {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model || "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      })
    }
    case "openai": {
      return fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
      })
    }
    case "google": {
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: 2048 },
          }),
        }
      )
    }
    case "groq": {
      return fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
      })
    }
    case "openrouter": {
      return fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "QAgrotis",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
      })
    }
    default:
      return new Response("Provedor não suportado.", { status: 400 })
  }
}

// ── Stream delta extractor per provider ──────────────────────────────────────

function extractDelta(provider: string, parsed: unknown): string {
  const p = parsed as Record<string, unknown>
  if (provider === "anthropic") {
    if (p.type === "content_block_delta") {
      const delta = p.delta as Record<string, unknown>
      return (delta?.text as string) ?? ""
    }
    return ""
  }
  if (provider === "google") {
    const candidates = p.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined
    return candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  }
  // openai / groq / openrouter
  const choices = p.choices as { delta?: { content?: string } }[] | undefined
  return choices?.[0]?.delta?.content ?? ""
}

// ── Simple in-memory rate limiter ─────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 20 // requests per window per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (!checkRateLimit(session.user.id)) {
    return new Response("Muitas requisições. Aguarde um momento antes de continuar.", { status: 429 })
  }

  let body: {
    pergunta: string
    sistema: string
    integracaoId?: string
    historico?: { role: "user" | "assistant"; content: string }[]
  }
  try {
    body = await req.json()
  } catch {
    return new Response("JSON inválido.", { status: 400 })
  }

  const { pergunta, sistema = "Geral", integracaoId, historico = [] } = body

  if (!pergunta?.trim()) {
    return new Response("A pergunta não pode ser vazia.", { status: 400 })
  }
  if (pergunta.length > 600) {
    return new Response("Pergunta muito longa (máximo 600 caracteres).", { status: 400 })
  }

  // Pick integration: prefer the one selected by user, then first Anthropic, then any active
  const integracoes = await getIntegracoes()
  const integracao = integracaoId
    ? (integracoes.find((i) => i.active && i.id === integracaoId) ?? integracoes.find((i) => i.active))
    : (integracoes.find((i) => i.active && i.provider === "anthropic") ?? integracoes.find((i) => i.active))

  if (!integracao) {
    return new Response(
      "Nenhuma integração de IA ativa encontrada. Configure uma integração em Configurações → Integrações.",
      { status: 503 }
    )
  }

  // Fetch and cache GitBook content
  let gitbookContent = ""
  try {
    gitbookContent = await fetchGitBookContent()
  } catch (err) {
    console.warn("[assistente] GitBook fetch error (falling back to empty):", err)
    gitbookContent = "Informação não disponível no momento."
  }

  const relevantContext = findRelevantSections(gitbookContent, pergunta, sistema)
  const systemPrompt = SYSTEM_PROMPT
    .replace("{sistema}", sistema)
    .replace("{contexto}", relevantContext)

  // Build conversation history (last 8 exchanges = 16 messages)
  const messages: { role: string; content: string }[] = [
    ...historico.slice(-16),
    { role: "user", content: pergunta },
  ]

  const providerNorm = integracao.provider.toLowerCase().trim()
  if (!integracao.apiKey) {
    return new Response(`API Key da integração "${integracao.descricao || integracao.model}" está vazia. Configure em Configurações → Integrações.`, { status: 503 })
  }
  const res = await callProvider(providerNorm, integracao.model, integracao.apiKey, systemPrompt, messages)
  if (!res.ok) {
    const err = await res.text()
    console.error("[assistente] Provider error:", integracao.provider, res.status, err.slice(0, 300))
    // Return detailed error so the user can see what went wrong
    let userMsg = `Erro no modelo de IA (${integracao.model}): `
    if (res.status === 401 || res.status === 403) userMsg += "API Key inválida ou sem permissão."
    else if (res.status === 429) userMsg += "Cota excedida. Aguarde alguns minutos."
    else if (res.status === 400) userMsg += `Requisição inválida — ${err.slice(0, 150)}`
    else userMsg += `${res.status} — ${err.slice(0, 150)}`
    return new Response(userMsg, { status: 502 })
  }

  // Stream the response through — provider-agnostic delta extraction
  const { provider } = integracao
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              const text = extractDelta(provider, parsed)
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* ignore parse errors */ }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
