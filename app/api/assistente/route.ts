import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import * as jose from "jose"

const GITBOOK_ORG_ID = process.env.GITBOOK_ORG_ID ?? "YJL6kpwzoMMhtvwRrmNt"
const GITBOOK_SITE_ID = process.env.GITBOOK_SITE_ID ?? "site_YbjJD"
const GITBOOK_API_TOKEN = process.env.GITBOOK_API_TOKEN ?? ""
const GITBOOK_PRIVATE_KEY = process.env.GITBOOK_PRIVATE_KEY ?? ""

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

// ── Generate visitor JWT signed with GitBook Private Key ──────────────────────
async function generateVisitorJWT(): Promise<string> {
  const secret = new TextEncoder().encode(GITBOOK_PRIVATE_KEY)
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret)
}

// ── Parse GitBook SSE stream ──────────────────────────────────────────────────
function parseGitBookSSE(rawText: string): { answer: string; sources: string[] } {
  const lines = rawText.split("\n").filter((l) => l.startsWith("data:"))
  let answer = ""
  const sources: string[] = []

  for (const line of lines) {
    const payload = line.slice(5).trim()
    if (payload === "done" || payload === "") continue
    try {
      const parsed = JSON.parse(payload)
      if (parsed.answer?.text) answer = parsed.answer.text
      if (parsed.answer?.markdown) answer = parsed.answer.markdown
      if (parsed.answer?.answer?.markdown) answer = parsed.answer.answer.markdown
      if (parsed.answer?.answer?.text) answer = parsed.answer.answer.text
      const srcArr = parsed.answer?.sources ?? parsed.sources ?? []
      for (const s of srcArr) {
        const title = s.page?.title ?? s.title ?? s.page ?? ""
        if (title && !sources.includes(title)) sources.push(title)
      }
    } catch { /* skip */ }
  }
  return { answer, sources }
}

// ── GitBook Ask ───────────────────────────────────────────────────────────────
async function askGitBook(question: string, sistema: string): Promise<string> {
  if (!GITBOOK_API_TOKEN) throw new Error("GITBOOK_API_TOKEN não configurado.")
  if (!GITBOOK_PRIVATE_KEY) throw new Error("GITBOOK_PRIVATE_KEY não configurada.")

  const visitorJWT = await generateVisitorJWT()
  const queryText = sistema && sistema !== "Geral" ? `[${sistema}] ${question}` : question

  const res = await fetch(
    `https://api.gitbook.com/v1/orgs/${GITBOOK_ORG_ID}/sites/${GITBOOK_SITE_ID}/ask`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITBOOK_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-GitBook-Token": visitorJWT,
      },
      body: JSON.stringify({
        question: queryText,
        scope: { mode: "default" },
        visitor: { jwtToken: visitorJWT },
      }),
    }
  )

  const raw = await res.text()
  console.log("[assistente] status:", res.status, "| raw:", raw.slice(0, 400))

  if (!res.ok) throw new Error(`GitBook API ${res.status}: ${raw.slice(0, 200)}`)

  const { answer, sources } = parseGitBookSSE(raw)

  if (!answer) throw new Error(`Resposta vazia do GitBook. Raw: ${raw.slice(0, 300)}`)

  const srcLines = sources.slice(0, 3).map((s) => `- ${s}`).join("\n")
  return srcLines ? `${answer}\n\n**Fontes:**\n${srcLines}` : answer
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
    return new Response(`⚠️ ${msg}`, { status: 503 })
  }
}
