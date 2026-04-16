import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

const GITBOOK_ORG_ID = process.env.GITBOOK_ORG_ID ?? "YJL6kpwzoMMhtvwRrmNt"
const GITBOOK_SITE_ID = process.env.GITBOOK_SITE_ID ?? "site_YbjJD"
const GITBOOK_API_TOKEN = process.env.GITBOOK_API_TOKEN ?? ""

// ── Rate limiter ──────────────────────────────────────────────────────────────
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

// ── Parse GitBook SSE stream ──────────────────────────────────────────────────
// GitBook streams "data: {...}\n" lines and ends with "data: done"
function parseGitBookSSE(rawText: string): { answer: string; sources: string[] } {
  const lines = rawText.split("\n").filter((l) => l.startsWith("data:"))
  
  let answer = ""
  const sources: string[] = []

  for (const line of lines) {
    const payload = line.slice(5).trim()
    if (payload === "done" || payload === "") continue
    
    try {
      const parsed = JSON.parse(payload)
      
      // Sites Ask API response shape
      if (parsed.answer?.text) answer = parsed.answer.text
      if (parsed.answer?.markdown) answer = parsed.answer.markdown
      
      // Org Ask API response shape: answer.answer.markdown
      if (parsed.answer?.answer?.markdown) answer = parsed.answer.answer.markdown
      if (parsed.answer?.answer?.text) answer = parsed.answer.answer.text

      // Sources
      if (Array.isArray(parsed.answer?.sources)) {
        for (const s of parsed.answer.sources) {
          const title = s.page?.title ?? s.title ?? s.page ?? ""
          if (title && !sources.includes(title)) sources.push(title)
        }
      }
      if (Array.isArray(parsed.sources)) {
        for (const s of parsed.sources) {
          const title = s.page?.title ?? s.title ?? s.page ?? ""
          if (title && !sources.includes(title)) sources.push(title)
        }
      }
    } catch { /* skip non-JSON lines */ }
  }

  return { answer, sources }
}

// ── GitBook Ask ───────────────────────────────────────────────────────────────
async function askGitBook(question: string, sistema: string): Promise<string> {
  if (!GITBOOK_API_TOKEN) {
    throw new Error("GITBOOK_API_TOKEN não configurado no Vercel.")
  }

  const headers = {
    "Authorization": `Bearer ${GITBOOK_API_TOKEN}`,
    "Content-Type": "application/json",
  }

  const queryText = sistema && sistema !== "Geral"
    ? `[${sistema}] ${question}`
    : question

  // Try sites Ask endpoint first
  const siteRes = await fetch(
    `https://api.gitbook.com/v1/orgs/${GITBOOK_ORG_ID}/sites/${GITBOOK_SITE_ID}/ask`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ question: queryText, scope: { mode: "default" } }),
    }
  )

  const siteRaw = await siteRes.text()
  console.log("[assistente] site status:", siteRes.status)
  console.log("[assistente] site raw (first 500):", siteRaw.slice(0, 500))

  if (siteRes.ok) {
    const { answer, sources } = parseGitBookSSE(siteRaw)
    if (answer) {
      const srcLines = sources.slice(0, 3).map((s) => `- ${s}`).join("\n")
      return srcLines ? `${answer}\n\n**Fontes:**\n${srcLines}` : answer
    }
    // Return raw for diagnosis if no answer parsed
    throw new Error(`Site ask OK but no answer parsed. Raw: ${siteRaw.slice(0, 300)}`)
  }

  throw new Error(`Site ask ${siteRes.status}: ${siteRaw.slice(0, 300)}`)
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  if (!checkRateLimit(session.user.id)) {
    return new Response("Muitas requisições. Aguarde um momento.", { status: 429 })
  }

  let body: { pergunta: string; sistema: string }
  try { body = await req.json() }
  catch { return new Response("JSON inválido.", { status: 400 }) }

  const { pergunta, sistema = "Geral" } = body
  if (!pergunta?.trim()) return new Response("Pergunta vazia.", { status: 400 })
  if (pergunta.length > 600) return new Response("Pergunta muito longa.", { status: 400 })

  try {
    const answer = await askGitBook(pergunta, sistema)
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(answer))
          controller.close()
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[assistente] error:", msg)
    return new Response(`⚠️ Erro ao consultar documentação: ${msg}`, { status: 503 })
  }
}
