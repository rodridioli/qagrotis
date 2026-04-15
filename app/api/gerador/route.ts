import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { getIntegracao } from "@/lib/actions/integracoes"

const SYSTEM_PROMPT = `Aja como um QA Engineer Sênior especialista em testes funcionais, testes manuais e BDD.

## REGRA ABSOLUTA — SAÍDA
Sua resposta deve conter APENAS os cenários no formato exato abaixo.
NÃO escreva nenhum texto antes do primeiro cenário (sem introdução, sem "Aqui estão os cenários", sem títulos, sem comentários).
NÃO escreva nenhum texto depois do último cenário (sem conclusão, sem resumo).
Comece DIRETAMENTE com "Cenário:" e termine com "---" após o último cenário.

## OBJETIVO
Gerar casos de teste estruturados no formato QA (CTs) com base nas informações fornecidas.

## LIMITAÇÕES
- NÃO acessar URLs externas
- Trabalhar apenas com o conteúdo fornecido
- Se faltar informação, usar "Não informado" no campo correspondente

## FORMATO OBRIGATÓRIO — copie EXATAMENTE esta estrutura para cada cenário (sem asteriscos, sem markdown bold)

Cenário: [nome do cenário — sem colchetes, escreva o nome real]
Descrição: [descrição objetiva do que o cenário valida]
Regra de negócio: [detalhamento da regra de negócio. Se não houver, escreva: Não informado]

Pré-condições:
- [pré-condição 1]
- [pré-condição 2]
- [adicione quantas forem necessárias]

BDD (Gherkin):
DADO que o usuário [contexto inicial]
E [condição adicional, se houver]
QUANDO ele [ação executada]
ENTÃO o sistema deve [resultado esperado principal]
E [resultado adicional, se houver]

Resultado esperado:
- [resultado esperado 1]
- [resultado esperado 2]
- [resultado esperado 3]
- [adicione quantos forem necessários]

---

## REGRAS INVIOLÁVEIS

1. Cada cenário DEVE conter EXATAMENTE estes 6 campos na ordem acima:
   - Cenário:
   - Descrição:
   - Regra de negócio:
   - Pré-condições:
   - BDD (Gherkin):
   - Resultado esperado:

2. NÃO usar asteriscos (**) em nenhum campo — os rótulos são texto puro, sem bold, sem markdown

3. NUNCA adicionar campos extras além dos 6 listados acima (sem Módulo, sem Tipo, sem Caminho da Tela, sem nenhum outro campo)

4. O BDD DEVE seguir a estrutura Gherkin com palavras-chave em MAIÚSCULAS: DADO, E, QUANDO, ENTÃO
   - Use "E" para adicionar condições ao DADO ou resultados ao ENTÃO
   - NÃO use colchetes, placeholders ou texto entre [ ] no BDD — escreva o conteúdo real

5. Separar cada cenário com "---" (inclusive após o último)

6. Linguagem clara, objetiva e testável — evitar termos vagos

7. NÃO use formatação markdown de heading (# ou ##) nos cenários

## COBERTURA MÍNIMA

Incluir cenários para:
- Fluxo feliz (caminho principal)
- Validações de campos obrigatórios
- Regra de negócio crítica
- Cenário de erro relevante
- Edge case (se aplicável)

## CHECKLIST FINAL — valide CADA cenário antes de gerar a saída

✓ Começa com "Cenário:" seguido do nome (sem colchetes, sem asteriscos)?
✓ Tem "Descrição:" com texto real na mesma linha?
✓ Tem "Regra de negócio:" com texto real (ou "Não informado")?
✓ Tem "Pré-condições:" com bullets abaixo?
✓ Tem "BDD (Gherkin):" com DADO/QUANDO/ENTÃO sem colchetes?
✓ Tem "Resultado esperado:" com bullets abaixo?
✓ Termina com "---"?
✓ NÃO há asteriscos (**) em nenhuma parte do cenário?
✓ NÃO há texto introdutório antes do primeiro "Cenário:"?
✓ NÃO há campos extras além dos 6 obrigatórios?`

// ── Provider routing ──────────────────────────────────────────────────────────

async function streamAnthropic(
  userMessage: string,
  images?: { dataUrl: string; name: string }[],
  keyOverride?: string
): Promise<Response> {
  const apiKey = keyOverride || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response("Informe sua ANTHROPIC_API_KEY no campo de API Key.", { status: 500 })

  // Build multimodal content for Anthropic
  const contentParts: unknown[] = []
  if (images?.length) {
    for (const img of images) {
      const commaIdx = img.dataUrl.indexOf(",")
      if (commaIdx === -1) continue
      const base64 = img.dataUrl.slice(commaIdx + 1)
      const mimeMatch = img.dataUrl.slice(0, commaIdx).match(/data:([^;]+);base64/)
      if (mimeMatch && base64) {
        contentParts.push({
          type: "image",
          source: { type: "base64", media_type: mimeMatch[1], data: base64 },
        })
      }
    }
  }
  contentParts.push({ type: "text", text: userMessage })

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentParts }],
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

// Common OpenRouter model ID aliases to correct typical mistakes
const OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.0-flash-lite:free": "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemini-flash-lite:free": "google/gemini-2.0-flash-lite-preview-02-05:free",
  "openrouter/free": "openrouter/auto",
  "free": "openrouter/auto",
}

// Fallback models to try in order when the configured model is unavailable
const OPENROUTER_FALLBACK_MODELS = [
  "openrouter/auto",                             // let OpenRouter pick best available
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-8b:free",
  "google/gemma-3-4b-it:free",
]

function normalizeOpenRouterModel(model: string): string {
  return OPENROUTER_MODEL_ALIASES[model.toLowerCase()] ?? model
}

async function streamOpenRouter(
  userMessage: string,
  model: string,
  images?: { dataUrl: string; name: string }[],
  keyOverride?: string
): Promise<Response> {
  const apiKey = keyOverride || process.env.OPENROUTER_API_KEY
  if (!apiKey) return new Response("Informe sua OPENROUTER_API_KEY no campo de API Key.", { status: 500 })

  const resolvedModel = normalizeOpenRouterModel(model)

  const contentParts: { type: string; text?: string; image_url?: { url: string } }[] = [
    { type: "text", text: userMessage },
  ]
  if (images && images.length > 0) {
    for (const img of images) {
      contentParts.push({ type: "image_url", image_url: { url: img.dataUrl } })
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "QAgrotis",
    },
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
    }),
  })

  // Helper to attempt a single model
  async function tryModel(mdl: string): Promise<Response> {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "QAgrotis",
      },
      body: JSON.stringify({
        model: mdl,
        max_tokens: 8192,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contentParts },
        ],
      }),
    })
    return r
  }

  // Try fallback models if the primary is unavailable (503/502/529)
  if (!res.ok && (res.status === 503 || res.status === 502 || res.status === 529)) {
    const fallbacks = OPENROUTER_FALLBACK_MODELS.filter((m) => m !== resolvedModel)
    for (const fallbackModel of fallbacks) {
      const fallbackRes = await tryModel(fallbackModel)
      if (fallbackRes.ok) {
        // Stream the fallback response
        const { provider: _p, ...rest } = { provider: "openrouter" }
        void rest
        const enc2 = new TextEncoder()
        const readable2 = new ReadableStream({
          async start(controller) {
            const reader = fallbackRes.body!.getReader()
            const decoder = new TextDecoder()
            let buf = ""
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buf += decoder.decode(value, { stream: true })
                const lines = buf.split("\n")
                buf = lines.pop() ?? ""
                for (const line of lines) {
                  if (!line.startsWith("data:")) continue
                  const data = line.slice(5).trim()
                  if (data === "[DONE]") continue
                  try {
                    const parsed = JSON.parse(data)
                    const text = parsed.choices?.[0]?.delta?.content ?? ""
                    if (text) controller.enqueue(enc2.encode(text))
                  } catch { /* ignore */ }
                }
              }
            } finally { controller.close() }
          },
        })
        return new Response(readable2, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
      }
    }
  }

  if (!res.ok) {
    const err = await res.text()
    try {
      const errJson = JSON.parse(err)
      const errMsg: string = errJson.error?.message ?? err

      if (errJson.error?.code === 429) {
        return new Response(
          "Cota excedida no modelo selecionado. Aguarde alguns minutos ou selecione outro modelo nas Configurações.",
          { status: 429 }
        )
      }

      if (/no endpoints found/i.test(errMsg)) {
        return new Response(
          `O modelo "${resolvedModel}" está temporariamente sem endpoints disponíveis no OpenRouter (instabilidade no tier gratuito). ` +
          `Tente outro modelo nas Configurações — sugestões estáveis: "meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free".`,
          { status: 503 }
        )
      }

      if (/not a valid model/i.test(errMsg) || /invalid model/i.test(errMsg)) {
        return new Response(
          `ID de modelo inválido: "${model}". Verifique o Model ID nas Configurações — use o formato exato da lista do OpenRouter ` +
          `(ex: "meta-llama/llama-3.1-8b-instruct:free" ou "mistralai/mistral-7b-instruct:free").`,
          { status: 400 }
        )
      }

      return new Response(`Erro na API OpenRouter: ${errMsg}`, { status: res.status })
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

// ── Vision-specific instruction injected when images are present ───────────────

const VISION_INSTRUCTION = `
## ANÁLISE DE INTERFACE (IMAGENS ANEXADAS)

Você é um QA Engineer Sênior especializado em sistemas ERP agrícolas. Analise cuidadosamente cada print da interface do sistema Agrotis fornecido como se estivesse inspecionando a tela em um teste exploratório.

**Siga este roteiro de análise:**

1. **Mapeamento de elementos**: Identifique todos os elementos visíveis — campos de texto, selects, checkboxes, botões, links, mensagens de erro/sucesso, tabelas, modais, abas, filtros e painéis de navegação.
2. **Fluxos de interação**: Trace os caminhos que o usuário pode percorrer a partir da tela — incluindo ações encadeadas (ex: preencher formulário → salvar → confirmação).
3. **Estados possíveis**: Para cada elemento interativo, considere os estados: vazio, preenchido corretamente, preenchido com dado inválido, campo obrigatório em branco, desabilitado e carregando.
4. **Validações implícitas**: Infira regras de negócio a partir de labels, placeholders, asteriscos obrigatórios, máscaras de input e estrutura visual (ex: campos numéricos, datas, CPF/CNPJ).
5. **Integridade de dados agrícolas**: Dê atenção especial a campos como: safra, cultura, talhão, produtor, propriedade, insumo, dosagem, data de aplicação — estes são críticos para conformidade agronômica.
6. **Cobertura de testes**: Gere cenários nomeando os elementos exatamente como aparecem na interface (ex: "campo Safra", "botão Salvar", "aba Histórico").

Cruze a análise visual com o contexto/requisitos fornecidos para gerar cenários mais precisos e completos. Retorne apenas o Markdown dos cenários no formato especificado.
`

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
    return new Response("Nenhum modelo de IA selecionado. Recarregue a página e tente novamente.", { status: 400 })
  }

  if (!jira && (!imagens || imagens.length === 0)) {
    return new Response("Informe ao menos uma entrada.", { status: 400 })
  }

  const integracao = await getIntegracao(integrationId)
  if (!integracao) {
    return new Response(
      `Modelo de IA não encontrado (ID: ${integrationId}). ` +
      "Pode ter sido removido ou inativado. Recarregue a página e selecione outro modelo.",
      { status: 404 }
    )
  }
  if (!integracao.active) {
    return new Response("O modelo de IA selecionado está inativo. Selecione outro nas Configurações.", { status: 404 })
  }

  const hasImages = imagens && imagens.length > 0
  const textParts: string[] = []
  if (hasImages) textParts.push(VISION_INSTRUCTION)
  if (jira) textParts.push(`## Contexto / Requisitos\n${jira}`)
  if (hasImages) textParts.push(`## Imagens anexadas\n${imagens.map((img, i) => `${i + 1}. ${img.name}`).join("\n")}`)
  const userMessage = textParts.join("\n\n")
  const { model, apiKey } = integracao
  // Normalize provider to lowercase to handle values saved as "OpenRouter", "Google", etc.
  const provider = integracao.provider.toLowerCase().trim()

  switch (provider) {
    case "google":
      return streamGemini(userMessage, imagens, apiKey, model)
    case "groq":
      return streamGroq(userMessage, model, apiKey)
    case "openai":
      return streamOpenAI(userMessage, model, apiKey)
    case "anthropic":
      return streamAnthropic(userMessage, imagens, apiKey)
    case "openrouter":
      return streamOpenRouter(userMessage, model, imagens, apiKey)
    default:
      return new Response("Provedor não suportado.", { status: 400 })
  }
}
