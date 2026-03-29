import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

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

async function streamGemini(userMessage: string, keyOverride?: string): Promise<Response> {
  const apiKey = keyOverride || process.env.GOOGLE_API_KEY
  if (!apiKey) return new Response("Informe sua GOOGLE_API_KEY no campo de API Key.", { status: 500 })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return new Response(`Erro na API Google Gemini: ${err}`, { status: 502 })
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
    imagens?: string
    provider?: string
    apiKey?: string
  }

  const { jira, imagens, provider = "copilot", apiKey } = body
  const key = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined

  if (!jira && !imagens) {
    return new Response("Informe ao menos uma entrada.", { status: 400 })
  }

  const parts: string[] = []
  if (jira)    parts.push(`## Contexto\n${jira}`)
  if (imagens) parts.push(`## Anexos\n${imagens}`)
  const userMessage = parts.join("\n\n")

  switch (provider) {
    case "copilot":
      return streamOpenAI(userMessage, "gpt-4o", key)
    case "gemini":
      return streamGemini(userMessage, key)
    case "claude":
      return streamAnthropic(userMessage, key)
    case "llama":
      return streamGroq(userMessage, "llama-3.1-70b-versatile", key)
    case "mistral":
      return streamGroq(userMessage, "mixtral-8x7b-32768", key)
    default:
      if (key || process.env.ANTHROPIC_API_KEY) return streamAnthropic(userMessage, key)
      if (process.env.OPENAI_API_KEY)           return streamOpenAI(userMessage, "gpt-4o", key)
      if (process.env.GOOGLE_API_KEY)           return streamGemini(userMessage, key)
      return new Response("Informe sua API Key no campo correspondente.", { status: 500 })
  }
}
