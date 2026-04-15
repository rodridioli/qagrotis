import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { getIntegracoes } from "@/lib/actions/integracoes"

const GITBOOK_ORG_ID = process.env.GITBOOK_ORG_ID ?? "YJL6kpwzoMMhtvwRrmNt"
const GITBOOK_SITE_ID = process.env.GITBOOK_SITE_ID ?? "site_YbjJD"
const GITBOOK_API_TOKEN = process.env.GITBOOK_API_TOKEN ?? ""

// ── Simple in-memory rate limiter ─────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

// ── GitBook Ask API ───────────────────────────────────────────────────────────

async function askGitBook(question: string, sistema: string): Promise<string> {
  if (!GITBOOK_API_TOKEN) {
    throw new Error("Configure GITBOOK_API_TOKEN nas variáveis de ambiente do Vercel.")
  }

  const res = await fetch(
    `https://api.gitbook.com/v1/orgs/${GITBOOK_ORG_ID}/sites/${GITBOOK_SITE_ID}/ask`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITBOOK_API_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        question: sistema && sistema !== "Geral"
          ? `[${sistema}] ${question}`
          : question,
        scope: { mode: "default" },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitBook Ask API error ${res.status}: ${err.slice(0, 300)}`)
  }

  // GitBook may return SSE stream (data: {...}\n) or plain JSON
  const rawText = await res.text()

  let data: { answer?: { text?: string }; sources?: { page?: { title?: string } }[] } = {}

  if (rawText.trim().startsWith("data:")) {
    // SSE format — collect all data lines and use the last complete JSON
    const lines = rawText.split("\n").filter((l) => l.startsWith("data:"))
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line.slice(5).trim())
        // Merge: accumulate answer text and sources
        if (parsed.answer?.text) {
          data.answer = { text: (data.answer?.text ?? "") + parsed.answer.text }
        }
        if (parsed.sources) data.sources = parsed.sources
        // Final event usually has the full answer
        if (parsed.type === "answer" || parsed.answer?.text) {
          data = { ...data, ...parsed }
        }
      } catch { /* skip unparseable lines */ }
    }
  } else {
    try {
      data = JSON.parse(rawText)
    } catch {
      throw new Error(`GitBook response parse error: ${rawText.slice(0, 200)}`)
    }
  }

  const answer = data.answer?.text ?? ""
  if (!answer) {
    return "Não encontrei informações sobre isso na documentação disponível. Tente reformular sua pergunta ou entre em contato com o suporte técnico."
  }

  // Append sources if available
  const sources = (data.sources ?? [])
    .filter((s) => s.page?.title)
    .map((s) => `- ${s.page!.title}`)
    .slice(0, 3)

  if (sources.length > 0) {
    return `${answer}\n\n**Fontes:** \n${sources.join("\n")}`
  }

  return answer
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

  const { pergunta, sistema = "Geral" } = body

  if (!pergunta?.trim()) {
    return new Response("A pergunta não pode ser vazia.", { status: 400 })
  }
  if (pergunta.length > 600) {
    return new Response("Pergunta muito longa (máximo 600 caracteres).", { status: 400 })
  }

  try {
    const answer = await askGitBook(pergunta, sistema)
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(answer))
        controller.close()
      },
    })
    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[assistente] error:", msg)
    return new Response(`⚠️ Erro ao consultar documentação: ${msg}`, { status: 503 })
  }
}
