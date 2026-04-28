import { auth } from "@/lib/auth"
import { normalizeProvider } from "@/lib/ai/provider"
import { NextRequest } from "next/server"

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

// Vision-capable models tried in order — stops at first definitive result
const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
]

function isInvalidKeyError(errMessage: string, errStatus: string): boolean {
  const msg = errMessage.toLowerCase()
  return (
    msg.includes("api key not valid") ||
    msg.includes("invalid api key") ||
    msg.includes("api_key_invalid") ||
    (errStatus === "INVALID_ARGUMENT" && msg.includes("key"))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })
  const userId = session.user.id ?? session.user.email ?? ""
  if (!userId) return new Response("Unauthorized", { status: 401 })
  if (!checkValidateRateLimit(userId)) {
    return new Response("Muitas tentativas. Aguarde um momento.", { status: 429 })
  }

  const body = await req.json() as { apiKey?: string; provider?: string }
  const key = body.apiKey?.trim()
  const provider = normalizeProvider(body.provider) ?? normalizeProvider("google")

  if (!key) return new Response("apiKey é obrigatória.", { status: 400 })
  if (!provider) {
    return new Response("Provedor não suportado. Use: Google (Gemini), OpenRouter, OpenAI, Anthropic ou Groq.", { status: 400 })
  }

  if (provider === "google") {
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
        })
        if (res.ok || res.status === 429) return new Response("ok", { status: 200 })
        const errText = await res.text()
        let errJson: { error?: { message?: string; status?: string } } = {}
        try { errJson = JSON.parse(errText) } catch { /* non-JSON error body */ }
        if (res.status === 401 || isInvalidKeyError(errJson?.error?.message || "", errJson?.error?.status || "")) return new Response("Chave inválida.", { status: 401 })
      } catch { continue }
    }
  } else if (provider === "groq") {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      })
      if (res.ok || res.status === 429) return new Response("ok", { status: 200 })
      if (res.status === 401) return new Response("Chave inválida.", { status: 401 })
    } catch { /* ignore */ }
  } else if (provider === "openai") {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      })
      if (res.ok || res.status === 429) return new Response("ok", { status: 200 })
      if (res.status === 401) return new Response("Chave inválida.", { status: 401 })
    } catch { /* ignore */ }
  } else if (provider === "anthropic") {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      })
      if (res.ok || res.status === 429) return new Response("ok", { status: 200 })
      if (res.status === 401) return new Response("Chave inválida.", { status: 401 })
    } catch { /* ignore */ }
  } else if (provider === "openrouter") {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { "Authorization": `Bearer ${key}` },
      })
      if (res.ok) return new Response("ok", { status: 200 })
      if (res.status === 401 || res.status === 403) return new Response("Chave inválida.", { status: 401 })
    } catch { /* ignore */ }
  }

  return new Response("Não foi possível confirmar.", { status: 422 })
}
