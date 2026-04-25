import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export const dynamic = "force-dynamic"

// ── Rate limit: 120 sugestões/hora (debounce do front limita demanda real) ────

const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  for (const [k, v] of rateMap) { if (now > v.resetAt) rateMap.delete(k) }
  const entry = rateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + 60 * 60_000 })
    return true
  }
  if (entry.count >= 120) return false
  entry.count++
  return true
}

// ── Request validation ────────────────────────────────────────────────────────

const requestSchema = z.object({
  contexto: z.string().min(20, "Contexto muito curto").max(4000, "Contexto muito longo"),
  sistema: z.string().max(200).default(""),
})

// ── AI response validation ────────────────────────────────────────────────────

const aiResponseSchema = z.object({
  moduloDetectado: z.string().max(120).nullable().optional(),
  edgeCases: z.array(z.string().max(240)).max(6).default([]),
  cenariosSimilaresIds: z.array(z.string().max(40)).max(5).default([]),
})

export type SuggestionItem = {
  id: string
  name: string
  module: string
}

export type GeradorSuggestionsResponse = {
  moduloDetectado: string | null
  edgeCases: string[]
  cenariosSimilares: SuggestionItem[]
}

// ── Sanitize input ────────────────────────────────────────────────────────────

function sanitize(s: string, max = 4000): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, max)
}

// ── AI providers (reuse pattern from command-bar) ─────────────────────────────

async function callAnthropic(system: string, user: string, model: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      stream: false,
      system,
      messages: [{ role: "user", content: user }],
    }),
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
    body: JSON.stringify({
      model,
      max_tokens: 800,
      stream: false,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
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
      generationConfig: { maxOutputTokens: 800 },
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  return data.candidates[0]?.content?.parts?.map((p) => p.text).join("") ?? ""
}

async function callProvider(system: string, user: string, provider: string, model: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const p = provider.toLowerCase().trim()
  switch (p) {
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

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(sistema: string, modulos: string[], cenarios: { id: string; name: string; module: string }[]): string {
  const modulosStr = modulos.length > 0 ? modulos.join(", ") : "nenhum"
  const cenariosStr = cenarios.length > 0
    ? cenarios.map((c) => `${c.id} | ${c.name} | ${c.module}`).join("\n")
    : "nenhum cadastrado"

  return `Você é um assistente especializado em QA para o sistema agrícola Agroforte (QAgrotis).
Sua tarefa: analisar o contexto que o QA está digitando para gerar um cenário de teste e devolver sugestões úteis.

Sistema atual: ${sistema || "não selecionado"}
Módulos disponíveis: ${modulosStr}

Cenários já existentes (id | nome | módulo):
${cenariosStr}

Responda APENAS com JSON válido (sem markdown, sem explicação) neste formato:
{
  "moduloDetectado": "NomeExatoDeUmDosModulos" | null,
  "edgeCases": ["edge case 1", "edge case 2", "edge case 3"],
  "cenariosSimilaresIds": ["id1", "id2"]
}

REGRAS:
- moduloDetectado: escolha o módulo da lista que melhor combina com o contexto, ou null se não tiver certeza. Use EXATAMENTE o nome da lista.
- edgeCases: 3 a 5 cenários de borda/erro que o QA costuma esquecer para esse tipo de fluxo (validações, permissões, dados inválidos, concorrência, integração, sessão expirada, etc.). Curtos e específicos ao contexto — não genéricos.
- cenariosSimilaresIds: até 5 IDs de cenários EXISTENTES (da lista acima) que parecem cobrir o mesmo fluxo, para evitar duplicata. Vazio se nenhum for similar.
- Não invente IDs de cenário. Use apenas os listados.
- Não invente nomes de módulo. Use apenas os listados.
- Responda em português do Brasil.`
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id ?? session.user.email ?? "session"

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Limite de sugestões atingido" }, { status: 429 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validação falhou" }, { status: 400 })
  }

  const cleanContexto = sanitize(parsed.data.contexto)
  const cleanSistema = sanitize(parsed.data.sistema, 200)
  if (!cleanContexto || cleanContexto.length < 20) {
    return NextResponse.json({ error: "Contexto vazio" }, { status: 400 })
  }

  const [integration, modulosRaw, cenariosRaw] = await Promise.all([
    getActiveIntegration(),
    prisma.modulo.findMany({
      where: cleanSistema ? { sistemaName: cleanSistema, active: true } : { active: true },
      select: { name: true },
      take: 50,
      orderBy: { name: "asc" },
    }),
    prisma.cenario.findMany({
      where: {
        active: true,
        ...(cleanSistema ? { system: cleanSistema } : {}),
      },
      select: { id: true, scenarioName: true, module: true },
      take: 80,
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (!integration) {
    return NextResponse.json({ error: "Nenhuma integração de IA configurada" }, { status: 503 })
  }

  const modulos = modulosRaw.map((m) => m.name)
  const cenariosForPrompt = cenariosRaw.map((c) => ({ id: c.id, name: c.scenarioName, module: c.module }))

  const systemPrompt = buildSystemPrompt(cleanSistema, modulos, cenariosForPrompt)

  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), 20_000)

  try {
    const raw = await callProvider(systemPrompt, cleanContexto, integration.provider, integration.model, integration.apiKey, abort.signal)
    clearTimeout(timeout)

    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let parsedAi: unknown
    try {
      parsedAi = JSON.parse(jsonText)
    } catch {
      console.error("[gerador-suggestions] AI returned non-JSON:", raw.slice(0, 200))
      return NextResponse.json<GeradorSuggestionsResponse>({ moduloDetectado: null, edgeCases: [], cenariosSimilares: [] })
    }

    const validated = aiResponseSchema.safeParse(parsedAi)
    if (!validated.success) {
      console.error("[gerador-suggestions] schema fail:", validated.error.flatten())
      return NextResponse.json<GeradorSuggestionsResponse>({ moduloDetectado: null, edgeCases: [], cenariosSimilares: [] })
    }

    const cenariosMap = new Map(cenariosRaw.map((c) => [c.id, { id: c.id, name: c.scenarioName, module: c.module }]))
    const cenariosSimilares: SuggestionItem[] = []
    for (const id of validated.data.cenariosSimilaresIds ?? []) {
      const found = cenariosMap.get(id)
      if (found) cenariosSimilares.push(found)
    }

    const moduloDetectado = validated.data.moduloDetectado && modulos.includes(validated.data.moduloDetectado)
      ? validated.data.moduloDetectado
      : null

    const response: GeradorSuggestionsResponse = {
      moduloDetectado,
      edgeCases: validated.data.edgeCases ?? [],
      cenariosSimilares,
    }

    return NextResponse.json<GeradorSuggestionsResponse>(response)
  } catch (err) {
    clearTimeout(timeout)
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "Timeout" }, { status: 504 })
    }
    console.error("[gerador-suggestions] AI call error:", err)
    return NextResponse.json<GeradorSuggestionsResponse>({ moduloDetectado: null, edgeCases: [], cenariosSimilares: [] })
  }
}
