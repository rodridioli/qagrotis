import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

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
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json() as { apiKey?: string }
  const key = body.apiKey?.trim()

  if (!key) {
    return new Response("apiKey é obrigatória.", { status: 400 })
  }

  for (const model of CANDIDATE_MODELS) {
    try {
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

      // Key accepted — connection confirmed
      if (res.ok) {
        return new Response("ok", { status: 200 })
      }

      // Rate limited — key is valid, just quota exceeded
      if (res.status === 429) {
        return new Response("ok", { status: 200 })
      }

      // Parse error body to distinguish invalid key from other errors
      let errMessage = ""
      let errStatus = ""
      try {
        const errText = await res.text()
        const errJson = JSON.parse(errText)
        errMessage = errJson?.error?.message ?? ""
        errStatus = errJson?.error?.status ?? ""
      } catch { /* ignore parse errors */ }

      // Definitive: key is wrong
      if (res.status === 401 || isInvalidKeyError(errMessage, errStatus)) {
        return new Response("Chave inválida.", { status: 401 })
      }

      // 403 PERMISSION_DENIED without "key" in message = billing/access issue,
      // key format is correct → treat as uncertain, try next model
      // 400/404 for model unavailable → try next model
    } catch {
      // Network error trying this model — try next
    }
  }

  // All models responded without a definitive auth error — key may be valid
  // (quota exhausted, region restriction, billing not enabled, etc.)
  return new Response("Não foi possível confirmar — pode ser cota ou permissão de faturamento. Você pode salvar assim mesmo.", { status: 422 })
}
