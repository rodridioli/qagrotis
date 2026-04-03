import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { getIntegracao } from "@/lib/actions/integracoes"

const SYSTEM_PROMPT = `Aja como um QA Engineer Sênior especialista em testes funcionais, testes manuais e BDD.

## OBJETIVO
Gerar casos de teste estruturados no formato QA (CTs) com base nas informações fornecidas.

## IMPORTANTE (LIMITAÇÕES DA IA)
- NÃO acessar URLs externas (ex: Jira)
- Trabalhar apenas com o conteúdo fornecido
- Se faltar informação, NÃO inventar — declarar suposições

## PROCESSAMENTO

1. Identifique:
- Objetivo da funcionalidade
- Regras de negócio
- Fluxos principais
- Pontos críticos
- Possíveis falhas

2. Priorize cenários:
- Fluxo principal (crítico)
- Regras de negócio
- Validações importantes
- Erros relevantes
- Edge cases com impacto real

## FORMATO DE SAÍDA (OBRIGATÓRIO)

Gere os casos neste formato:

## CTXXX: <título do cenário>

**Descrição:**
<explicação clara do objetivo do teste>

**Caminho da tela:**
<ex: Sistema > Módulo > Tela>

**Pré-condições:**
- <lista objetiva>

**Cenário:**
**DADO** <contexto inicial>
**E** <condições adicionais>
**QUANDO** <ação do usuário>
**ENTÃO** <resultado esperado>
**E** <resultados adicionais>

**Resultados esperados:**
- <lista validável>
- <comportamentos esperados do sistema>

**Evidências:**
- <o que deve ser capturado: print, log, status, etc.>

---

## REGRAS DE GERAÇÃO

- Criar múltiplos cenários (CT001, CT002, CT003…)
- Focar nos mais importantes (evitar volume desnecessário)
- Cenários independentes
- Linguagem clara e testável
- Evitar termos vagos como "funcionar corretamente"

## COBERTURA MÍNIMA

Garantir que existam cenários para:
- Fluxo feliz
- Validação de campos
- Regra de negócio crítica
- Cenário de erro relevante
- Comportamento alternativo
- Edge case (se aplicável)

## CLASSIFICAÇÃO (ADICIONAR AO FINAL DE CADA CT)

Adicionar:
- Prioridade: Alta / Média / Baixa
- Tipo: Funcional / Validação / Erro / Edge Case

## AMBIGUIDADES

Ao final, incluir:

### Suposições
- <lista>

### Pontos em aberto
- <lista>

## CHECKLIST FINAL (OBRIGATÓRIO)

Antes de finalizar, valide:
- Existe cenário crítico do fluxo principal?
- Existe pelo menos 1 cenário de erro relevante?
- As regras de negócio foram cobertas?
- Os testes são executáveis manualmente?
- Está claro para um QA sem contexto adicional?`

// ── Provider routing ──────────────────────────────────────────────────────────

async function streamAnthropic(userMessage: string, keyOverride?: string): Promise<Response> {
  const apiKey = keyOverride || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response("Informe sua ANTHROPIC_API_KEY no campo de API Key.", { status: 500 })

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`Erro na API Anthropic: ${err}`, { status: 502 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const data = line.slice(5).trim()
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              controller.enqueue(encoder.encode(parsed.delta.text))
            }
          } catch { /* ignore */ }
        }
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

async function streamOpenAI(userMessage: string, model = "gpt-4o", keyOverride?: string): Promise<Response> {
  const apiKey = keyOverride || process.env.OPENAI_API_KEY
  if (!apiKey) return new Response("Informe sua OPENAI_API_KEY no campo de API Key.", { status: 500 })

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`Erro na API OpenAI: ${err}`, { status: 502 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const data = line.slice(5).trim()
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) controller.enqueue(encoder.encode(delta))
          } catch { /* ignore */ }
        }
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

async function streamGemini(
  userMessage: string,
  images?: { dataUrl: string; name: string }[],
  keyOverride?: string,
  model = "gemini-1.5-flash",
): Promise<Response> {
  const apiKey = keyOverride || process.env.GOOGLE_API_KEY
  if (!apiKey) return new Response("Informe sua GOOGLE_API_KEY no campo de API Key.", { status: 500 })

  // Build message parts — text first, then inline images
  const userParts: unknown[] = [{ text: userMessage }]
  if (images?.length) {
    for (const img of images) {
      const commaIdx = img.dataUrl.indexOf(",")
      if (commaIdx === -1) continue
      const header = img.dataUrl.slice(0, commaIdx)
      const base64 = img.dataUrl.slice(commaIdx + 1)
      const mimeMatch = header.match(/data:([^;]+);base64/)
      if (mimeMatch && base64) {
        userParts.push({ inline_data: { mime_type: mimeMatch[1], data: base64 } })
      }
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    try {
      const errJson = JSON.parse(errText)
      if (errJson.error?.code === 429) {
        return new Response("Cota excedida no Google Gemini (Free Tier). Por favor, aguarde alguns segundos ou utilize outro motor de IA (como Llama 3.1).", { status: 429 })
      }
      return new Response(`Erro na API Google Gemini: ${errJson.error?.message || errText}`, { status: res.status })
    } catch {
      return new Response(`Erro na API Google Gemini: ${errText}`, { status: res.status })
    }
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const data = line.slice(5).trim()
          try {
            const parsed = JSON.parse(data)
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) controller.enqueue(encoder.encode(text))
          } catch { /* ignore */ }
        }
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

async function streamOpenRouter(
  userMessage: string,
  model: string,
  images?: { dataUrl: string; name: string }[],
  keyOverride?: string
): Promise<Response> {
  const apiKey = keyOverride || process.env.OPENROUTER_API_KEY
  if (!apiKey) return new Response("Informe sua OPENROUTER_API_KEY no campo de API Key.", { status: 500 })

  const contentParts: any[] = [{ type: "text", text: userMessage }]
  if (images && images.length > 0) {
    for (const img of images) {
      contentParts.push({
        type: "image_url",
        image_url: { url: img.dataUrl },
      })
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    try {
      const errJson = JSON.parse(err)
      if (errJson.error?.code === 429) {
        return new Response("Cota excedida no modelo selecionado. Tente outro modelo gratuito do OpenRouter.", { status: 429 })
      }
      return new Response(`Erro na API OpenRouter: ${errJson.error?.message || err}`, { status: res.status })
    } catch {
      return new Response(`Erro na API OpenRouter: ${err}`, { status: res.status })
    }
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const data = line.slice(5).trim()
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) controller.enqueue(encoder.encode(delta))
          } catch { /* ignore */ }
        }
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

async function streamGroq(userMessage: string, model: string, keyOverride?: string): Promise<Response> {
  const apiKey = keyOverride || process.env.GROQ_API_KEY
  if (!apiKey) return new Response("Informe sua GROQ_API_KEY no campo de API Key.", { status: 500 })

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`Erro na API Groq: ${err}`, { status: 502 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const data = line.slice(5).trim()
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) controller.enqueue(encoder.encode(delta))
          } catch { /* ignore */ }
        }
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json() as {
    jira?: string
    imagens?: { dataUrl: string; name: string }[]
    integrationId?: string
  }

  const { jira, imagens, integrationId } = body

  if (!integrationId) {
    return new Response("Selecione um Motor de IA antes de gerar.", { status: 400 })
  }

  if (!jira && (!imagens || imagens.length === 0)) {
    return new Response("Informe ao menos uma entrada.", { status: 400 })
  }

  const integracao = await getIntegracao(integrationId)
  if (!integracao || !integracao.active) {
    return new Response("Integração não encontrada ou inativa.", { status: 404 })
  }

  const textParts: string[] = []
  if (jira) textParts.push(`## Contexto\n${jira}`)
  if (imagens?.length) textParts.push(`## Anexos\n${imagens.map((img) => img.name).join(", ")}`)
  const userMessage = textParts.join("\n\n")
  const { provider, model, apiKey } = integracao

  switch (provider) {
    case "google":
      return streamGemini(userMessage, imagens, apiKey, model)
    case "groq":
      return streamGroq(userMessage, model, apiKey)
    case "openai":
      return streamOpenAI(userMessage, model, apiKey)
    case "anthropic":
      return streamAnthropic(userMessage, apiKey)
    case "openrouter":
      return streamOpenRouter(userMessage, model, imagens, apiKey)
    default:
      return new Response("Provedor não suportado.", { status: 400 })
  }
}
