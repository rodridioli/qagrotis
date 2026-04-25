import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { CommandBarResponse } from "@/components/qagrotis/CommandBar"

export const dynamic = "force-dynamic"

// ── Rate limit: 60 commands per user per hour ─────────────────────────────────

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

const requestSchema = z.object({
  command: z.string().min(1, "Comando é obrigatório").max(500, "Comando muito longo"),
  context: z.object({
    pathname: z.string().max(200).default("/"),
    sistema: z.string().max(200).default(""),
  }).default({}),
})

// ── AI response validation ────────────────────────────────────────────────────

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  module: z.string(),
  meta: z.string().optional(),
})

const aiResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), path: z.string().startsWith("/"), label: z.string() }),
  z.object({ type: z.literal("query"), title: z.string(), items: z.array(itemSchema).max(10), viewAllPath: z.string() }),
  z.object({
    type: z.literal("action"),
    actionType: z.enum(["create", "update", "delete"]),
    label: z.string().max(200),
    details: z.array(z.string().max(300)).max(10),
    payload: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal("error"), message: z.string().max(300), suggestion: z.string().max(500) }),
  z.object({ type: z.literal("clarify"), question: z.string().max(300), options: z.array(z.string().max(100)).max(8).optional() }),
])

// ── Sanitize user input before sending to AI ──────────────────────────────────

function sanitize(cmd: string): string {
  return cmd.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, 500)
}

// ── AI callers (non-streaming JSON) ──────────────────────────────────────────

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
      max_tokens: 1024,
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
      max_tokens: 1024,
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
      generationConfig: { maxOutputTokens: 1024 },
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
    case "anthropic":
      return callAnthropic(system, user, model, apiKey, signal)
    case "openai":
      return callOpenAICompat(system, user, model, apiKey, "https://api.openai.com/v1", signal)
    case "groq":
      return callOpenAICompat(system, user, model, apiKey, "https://api.groq.com/openai/v1", signal)
    case "openrouter":
      return callOpenAICompat(system, user, model, apiKey, "https://openrouter.ai/api/v1", signal)
    case "google":
      return callGemini(system, user, model, apiKey, signal)
    default:
      throw new Error(`Provedor não suportado: ${provider}`)
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(
  pathname: string,
  sistema: string,
  userName: string,
  modulos: string[],
  clientes: string[],
  suites: { id: string; suiteName: string; modulo: string }[],
): string {
  const suitesStr = suites.length > 0
    ? suites.map((s) => `${s.id} "${s.suiteName}" (${s.modulo})`).join(", ")
    : "nenhuma ativa"

  return `Você é o assistente de comandos do QAgrotis, plataforma de gestão de QA para sistemas agrícolas (ERP Agroforte).

Interprete o comando do usuário QA e responda APENAS com um JSON válido — sem markdown, sem texto explicativo.

CONTEXTO ATUAL:
- Rota: ${pathname}
- Sistema: ${sistema || "não selecionado"}
- Usuário: ${userName}
- Módulos disponíveis: ${modulos.length > 0 ? modulos.join(", ") : "nenhum cadastrado"}
- Suites ativas: ${suitesStr}

FORMATOS DE RESPOSTA — apenas estes três:

1. Navegação (usuário quer ir para uma tela):
{"type":"navigate","path":"/rota","label":"Nome da tela"}

2. Buscar cenários (consulta real no banco — use sempre que o usuário quiser ver/listar cenários):
{"type":"action","actionType":"create","label":"Buscar cenários","details":["filtros aplicados"],"payload":{"actionName":"buscar_cenarios","modulo":"NomeExato","comErro":true,"sistema":"${sistema}"}}
- modulo: use EXATAMENTE um dos módulos da lista acima, ou omita o campo se não especificado
- comErro: true somente se o usuário pedir cenários com erro/falha
- sistema: sempre "${sistema}" quando informado

3. Buscar suites (consulta real no banco — use sempre que o usuário quiser ver/listar suites):
{"type":"action","actionType":"create","label":"Buscar suites","details":["filtros aplicados"],"payload":{"actionName":"buscar_suites","ativas":true}}
- ativas: true para ativas, false para encerradas, omita para todas

4. Erro (comando fora do escopo suportado):
{"type":"error","message":"Mensagem curta","suggestion":"Tente: 'buscar cenários com erro', 'buscar suites ativas' ou 'ir para cenários'"}

ROTAS VÁLIDAS: /dashboard, /cenarios, /suites, /gerador, /equipe, /configuracoes, /atualizacoes

REGRAS:
- Para qualquer pedido de criar, editar, encerrar ou excluir: responda com navigate para a tela correta (/suites, /cenarios, etc.) — não tente executar essas ações
- Para qualquer consulta de dados: use buscar_cenarios ou buscar_suites
- Para navegar: use navigate com uma das rotas válidas
- Nunca invente nomes de módulos — use apenas os da lista acima ou omita
- Responda SOMENTE com o JSON, sem mais nada`
}

// ── Fallback: use ANTHROPIC_API_KEY env if no integration configured ───────────

async function getActiveIntegration() {
  const row = await prisma.integracao.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { provider: true, model: true, apiKey: true },
  })
  if (row) return row

  const fallbackKey = process.env.ANTHROPIC_API_KEY
  if (fallbackKey) {
    return { provider: "anthropic", model: "claude-sonnet-4-6", apiKey: fallbackKey }
  }

  return null
}

// ── Error response factory ────────────────────────────────────────────────────

const ERROR_RESPONSE: CommandBarResponse = {
  type: "error",
  message: "Não foi possível interpretar o comando.",
  suggestion: 'Tente: "Liste cenários com erro", "Crie uma suite para o módulo Financeiro" ou "Ir para configurações".',
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id ?? session.user.email ?? "session"

  if (!checkRateLimit(userId)) {
    return NextResponse.json<CommandBarResponse>({
      type: "error",
      message: "Limite de comandos atingido (60/hora).",
      suggestion: "Aguarde alguns minutos antes de tentar novamente.",
    }, { status: 429 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validação falhou", details: parsed.error.flatten() }, { status: 400 })
  }

  const { command, context } = parsed.data
  const cleanCommand = sanitize(command)
  if (!cleanCommand) {
    return NextResponse.json({ error: "Comando vazio" }, { status: 400 })
  }
  // Sanitize context fields to prevent prompt injection
  const cleanPathname = sanitize(context.pathname)
  const cleanSistema = sanitize(context.sistema)

  // Fetch integration + context data in parallel
  const [integration, modulosRaw, clientesRaw, suitesRaw] = await Promise.all([
    getActiveIntegration(),
    prisma.modulo.findMany({
      where: cleanSistema ? { sistemaName: cleanSistema, active: true } : { active: true },
      select: { name: true },
      take: 50,
      orderBy: { name: "asc" },
    }),
    prisma.cliente.findMany({
      where: { active: true },
      select: { nomeFantasia: true },
      take: 50,
      orderBy: { nomeFantasia: "asc" },
    }),
    prisma.suite.findMany({
      where: {
        active: true,
        encerrada: false,
        ...(cleanSistema ? { sistema: cleanSistema } : {}),
      },
      select: { id: true, suiteName: true, modulo: true },
      take: 20,
      orderBy: { suiteName: "asc" },
    }),
  ])

  if (!integration) {
    return NextResponse.json<CommandBarResponse>({
      type: "error",
      message: "Nenhuma integração de IA configurada.",
      suggestion: "Configure um modelo de IA em Configurações → Modelos de IA.",
    })
  }

  const modulos = modulosRaw.map((m) => m.name)
  const clientes = clientesRaw.map((c) => c.nomeFantasia)
  const suites = suitesRaw.map((s) => ({ id: s.id, suiteName: s.suiteName, modulo: s.modulo }))
  const userName = session.user.name ?? session.user.email ?? "Usuário"

  const systemPrompt = buildSystemPrompt(cleanPathname, cleanSistema, userName, modulos, clientes, suites)

  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), 25_000)

  try {
    const raw = await callProvider(systemPrompt, cleanCommand, integration.provider, integration.model, integration.apiKey, abort.signal)
    clearTimeout(timeout)

    // Strip markdown fences if the model wrapped the JSON
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      console.error("[command-bar] AI returned non-JSON:", raw.slice(0, 200))
      return NextResponse.json<CommandBarResponse>(ERROR_RESPONSE)
    }

    const validated = aiResponseSchema.safeParse(parsed)
    if (!validated.success) {
      console.error("[command-bar] AI response failed schema validation:", validated.error.flatten())
      return NextResponse.json<CommandBarResponse>(ERROR_RESPONSE)
    }

    return NextResponse.json<CommandBarResponse>(validated.data)
  } catch (err) {
    clearTimeout(timeout)
    if ((err as Error).name === "AbortError") {
      return NextResponse.json<CommandBarResponse>({
        type: "error",
        message: "O comando demorou muito para processar.",
        suggestion: "Tente um comando mais específico ou verifique sua conexão.",
      })
    }
    console.error("[command-bar] AI call error:", err)
    return NextResponse.json<CommandBarResponse>(ERROR_RESPONSE)
  }
}
