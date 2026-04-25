import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export const dynamic = "force-dynamic"

// ── Rate limit: 60 calls/h ────────────────────────────────────────────────────

const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  for (const [k, v] of rateMap) { if (now > v.resetAt) rateMap.delete(k) }
  const entry = rateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + 60 * 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

// ── Request validation ────────────────────────────────────────────────────────

const pageEnum = z.enum(["cenarios", "suites", "dashboard", "gerador", "equipe"])

const requestSchema = z.object({
  page: pageEnum,
  sistema: z.string().max(200).default(""),
  data: z.record(z.string(), z.unknown()).default({}),
})

// ── AI response validation ────────────────────────────────────────────────────

const suggestionSchema = z.object({
  type: z.enum(["warning", "info", "action"]),
  title: z.string().min(1).max(160),
  description: z.string().max(400),
  action: z.object({
    label: z.string().max(60),
    href: z.string().startsWith("/").max(300),
  }).optional(),
})

const aiResponseSchema = z.object({
  suggestions: z.array(suggestionSchema).max(6).default([]),
})

export type PageSuggestion = z.infer<typeof suggestionSchema>
export type PageAssistantResponse = { suggestions: PageSuggestion[] }
export type PageAssistantPage = z.infer<typeof pageEnum>

// ── Sanitize ──────────────────────────────────────────────────────────────────

function sanitize(s: string, max = 4000): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, max)
}

function sanitizeData(data: Record<string, unknown>): string {
  // Serialize and clip aggressively to avoid blowing up the prompt.
  try {
    return sanitize(JSON.stringify(data), 6000)
  } catch {
    return ""
  }
}

// ── AI providers ──────────────────────────────────────────────────────────────

async function callAnthropic(system: string, user: string, model: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1024, stream: false, system, messages: [{ role: "user", content: user }] }),
    signal,
  })
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`)
  const data = await res.json() as { content: { type: string; text: string }[] }
  return data.content.find((b) => b.type === "text")?.text ?? ""
}

async function callOpenAICompat(system: string, user: string, model: string, apiKey: string, baseUrl: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: 1024, stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal,
  })
  if (!res.ok) throw new Error(`AI error ${res.status}`)
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ""
}

async function callGemini(system: string, user: string, model: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  return data.candidates[0]?.content?.parts?.map((p) => p.text).join("") ?? ""
}

async function callProvider(system: string, user: string, provider: string, model: string, apiKey: string, signal: AbortSignal): Promise<string> {
  switch (provider.toLowerCase().trim()) {
    case "anthropic": return callAnthropic(system, user, model, apiKey, signal)
    case "openai": return callOpenAICompat(system, user, model, apiKey, "https://api.openai.com/v1", signal)
    case "groq": return callOpenAICompat(system, user, model, apiKey, "https://api.groq.com/openai/v1", signal)
    case "openrouter": return callOpenAICompat(system, user, model, apiKey, "https://openrouter.ai/api/v1", signal)
    case "google": return callGemini(system, user, model, apiKey, signal)
    default: throw new Error(`Provedor não suportado: ${provider}`)
  }
}

async function getActiveIntegration() {
  const row = await prisma.integracao.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { provider: true, model: true, apiKey: true },
  })
  if (row) return row
  const fallbackKey = process.env.ANTHROPIC_API_KEY
  if (fallbackKey) return { provider: "anthropic", model: "claude-sonnet-4-6", apiKey: fallbackKey }
  return null
}

// ── Per-page system prompt ────────────────────────────────────────────────────

function buildSystemPrompt(page: PageAssistantPage, sistema: string): string {
  const base = `Você é o assistente contextual do QAgrotis, plataforma de gestão de QA para o ERP agrícola Agroforte.
Sistema atual: ${sistema || "não selecionado"}

Sua tarefa: analisar os dados que o usuário está vendo nesta tela e gerar até 4 sugestões úteis e ACIONÁVEIS — não genéricas.

Responda APENAS com JSON válido (sem markdown, sem explicação):
{
  "suggestions": [
    {
      "type": "warning" | "info" | "action",
      "title": "string curto (máx 80 chars)",
      "description": "string explicando por quê (máx 240 chars)",
      "action": { "label": "string curto", "href": "/rota?filtros=opcional" } // opcional
    }
  ]
}

REGRAS GERAIS:
- "warning": problema/risco detectado (ex: cenários duplicados, suite com muitos erros)
- "info": observação útil (ex: tendência, padrão notado)
- "action": recomendação direta de algo que o QA deve fazer
- href quando fizer sentido — apenas rotas que realmente existem: /cenarios, /suites, /dashboard, /gerador, /equipe
- Não invente IDs nem nomes que não estão nos dados fornecidos
- Sugestões devem ser curtas, específicas e baseadas EM EVIDÊNCIA dos dados
- Se não houver insight útil, devolva suggestions vazio: {"suggestions":[]}
- Português do Brasil`

  const perPage: Record<PageAssistantPage, string> = {
    cenarios: `
CONTEXTO DA TELA: lista de cenários (com filtros aplicados).
FOQUE EM:
- Detectar possíveis duplicatas (cenários com nomes muito parecidos no mesmo módulo)
- Cenários com taxa alta de erro (campo "erros" alto vs execucoes)
- Cenários inativos misturados com ativos
- Sugerir agrupar cenários do mesmo módulo em uma suite (ofereça action com href "/suites")
- Cobertura desigual entre módulos`,

    suites: `
CONTEXTO DA TELA: lista de suites (com filtros aplicados).
FOQUE EM:
- Suites com baixa automação (% < 30) — sugerir priorizar
- Suites com histórico de erros consistentes
- Suites encerradas misturadas com ativas (filtro)
- Suites planejadas há muito tempo sem execução
- Sugerir cenários faltantes para cobertura (se você notar gaps)`,

    dashboard: `
CONTEXTO DA TELA: KPIs e métricas do usuário/sistema.
FOQUE EM:
- Anomalias nas métricas (queda brusca, pico inesperado)
- Módulos com baixa cobertura comparados aos demais
- Recomendações concretas baseadas nos números (ex: "execute mais testes manuais no módulo X que tem 0 execuções")
- Tendências da última semana/mês`,

    gerador: `
CONTEXTO DA TELA: formulário de geração de cenários (contexto, jira, anexos).
FOQUE EM:
- Se contexto está vazio: sugerir começar pelo Jira ou anexos
- Se já tem output gerado: lembrar de revisar antes de salvar
- Sugerir tipos de teste que costumam ser esquecidos (perfomance, segurança, edge cases)`,

    equipe: `
CONTEXTO DA TELA: lista de chapters e membros da equipe.
FOQUE EM:
- Gaps de conhecimento (chapters concentrados em poucas pessoas)
- Sugerir temas de chapters baseados nos módulos do sistema
- Membros sem chapter recente (incentivo para participar)`,
  }

  return base + "\n" + perPage[page]
}

const ERROR_RESPONSE: PageAssistantResponse = { suggestions: [] }

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id ?? session.user.email ?? "session"

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Limite atingido" }, { status: 429 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validação falhou" }, { status: 400 })
  }

  const { page, sistema, data } = parsed.data
  const cleanSistema = sanitize(sistema, 200)
  const dataStr = sanitizeData(data)

  const integration = await getActiveIntegration()
  if (!integration) {
    return NextResponse.json<PageAssistantResponse>({
      suggestions: [{
        type: "info",
        title: "Configure uma integração de IA",
        description: "Acesse Configurações → Modelos de IA para habilitar as sugestões contextuais.",
        action: { label: "Configurar", href: "/configuracoes" },
      }],
    })
  }

  const systemPrompt = buildSystemPrompt(page, cleanSistema)
  const userMessage = `Dados da tela "${page}":\n${dataStr}`

  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), 25_000)

  try {
    const raw = await callProvider(systemPrompt, userMessage, integration.provider, integration.model, integration.apiKey, abort.signal)
    clearTimeout(timeout)

    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let parsedAi: unknown
    try {
      parsedAi = JSON.parse(jsonText)
    } catch {
      console.error("[page-assistant] non-JSON:", raw.slice(0, 200))
      return NextResponse.json<PageAssistantResponse>(ERROR_RESPONSE)
    }

    const validated = aiResponseSchema.safeParse(parsedAi)
    if (!validated.success) {
      console.error("[page-assistant] schema fail:", validated.error.flatten())
      return NextResponse.json<PageAssistantResponse>(ERROR_RESPONSE)
    }

    return NextResponse.json<PageAssistantResponse>({ suggestions: validated.data.suggestions })
  } catch (err) {
    clearTimeout(timeout)
    if ((err as Error).name === "AbortError") {
      return NextResponse.json<PageAssistantResponse>(ERROR_RESPONSE)
    }
    console.error("[page-assistant] AI error:", err)
    return NextResponse.json<PageAssistantResponse>(ERROR_RESPONSE)
  }
}
