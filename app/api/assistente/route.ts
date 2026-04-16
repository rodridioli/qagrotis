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

// ── Extract plain text from GitBook document nodes ───────────────────────────
function extractTextFromDocument(doc: unknown): string {
  if (!doc || typeof doc !== "object") return ""
  const d = doc as Record<string, unknown>
  // Leaf node with text
  if (typeof d.text === "string") return d.text
  // Node with leaves array
  if (Array.isArray(d.leaves)) {
    return (d.leaves as unknown[]).map(extractTextFromDocument).join("")
  }
  // Node with nodes array
  if (Array.isArray(d.nodes)) {
    const parts = (d.nodes as unknown[]).map(extractTextFromDocument)
    // Add newline after block-level nodes
    const type = d.type as string ?? ""
    const isBlock = ["paragraph","heading-one","heading-two","heading-three","list-item","blockquote"].includes(type)
    return parts.join("") + (isBlock ? "\n" : "")
  }
  // Document root
  if (d.object === "document" && Array.isArray(d.nodes)) {
    return (d.nodes as unknown[]).map(extractTextFromDocument).join("")
  }
  return ""
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
      const a = parsed.answer

      // Format 1: answer.text or answer.markdown (plain string)
      if (a?.text) answer = a.text
      else if (a?.markdown) answer = a.markdown
      // Format 2: answer.answer.markdown or answer.answer.text
      else if (a?.answer?.markdown) answer = a.answer.markdown
      else if (a?.answer?.text) answer = a.answer.text
      // Format 3: answer.answer.document (rich document format)
      else if (a?.answer?.document) {
        answer = extractTextFromDocument(a.answer.document).trim()
      }

      // Sources
      const srcArr = a?.sources ?? parsed.sources ?? []
      for (const s of srcArr) {
        const title = s.page?.title ?? s.title ?? (typeof s.page === "string" ? s.page : "") ?? ""
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
