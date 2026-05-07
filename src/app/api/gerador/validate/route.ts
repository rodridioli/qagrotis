import { auth } from "@/lib/auth"

// Rate limit: max 10 validation requests per user per minute
const validateRateMap = new Map<string, { count: number; resetAt: number }>()
function checkValidateRateLimit(userId: string): boolean {
  const now = Date.now()
  for (const [k, v] of validateRateMap) { if (now > v.resetAt) validateRateMap.delete(k) }
  const entry = validateRateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    validateRateMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  const userId = session.user.id ?? session.user.email ?? ""
  if (!userId) return new Response("Unauthorized", { status: 401 })
  if (!checkValidateRateLimit(userId)) {
    return new Response("Muitas tentativas. Aguarde um momento.", { status: 429 })
  }

  const body = await req.json() as { provider?: string; apiKey?: string }
  const { provider, apiKey } = body

  if (!provider || !apiKey?.trim()) {
    return new Response("provider e apiKey são obrigatórios.", { status: 400 })
  }

  const key = apiKey.trim()

  try {
    switch (provider) {
      case "gemini":
      case "gemini-2": {
        const model = provider === "gemini-2" ? "gemini-2.0-flash" : "gemini-1.5-flash"
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "hi" }] }],
              generationConfig: { maxOutputTokens: 1 },
            }),
          }
        )
        if (res.status === 400 || res.status === 403 || res.status === 401) {
          return new Response("Chave inválida.", { status: 401 })
        }
        if (!res.ok) {
          const txt = await res.text()
          return new Response(`Erro: ${txt}`, { status: res.status })
        }
        return new Response("ok", { status: 200 })
      }

      case "llama":
      case "mistral": {
        const model = provider === "llama" ? "llama-3.1-70b-versatile" : "mixtral-8x7b-32768"
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        })
        if (res.status === 401 || res.status === 403) {
          return new Response("Chave inválida.", { status: 401 })
        }
        if (!res.ok) {
          const txt = await res.text()
          return new Response(`Erro: ${txt}`, { status: res.status })
        }
        return new Response("ok", { status: 200 })
      }

      default:
        return new Response("Provider não suportado.", { status: 400 })
    }
  } catch {
    return new Response("Falha ao verificar a chave.", { status: 502 })
  }
}
