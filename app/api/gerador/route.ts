import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { getIntegracao } from "@/lib/actions/integracoes"
import { normalizeProvider } from "@/lib/ai/provider"

// Rate limit: max 30 AI generations per user per hour
const geradorRateMap = new Map<string, { count: number; resetAt: number }>()
function checkGeradorRateLimit(userId: string): boolean {
  const now = Date.now()
  for (const [k, v] of geradorRateMap) { if (now > v.resetAt) geradorRateMap.delete(k) }
  const entry = geradorRateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    geradorRateMap.set(userId, { count: 1, resetAt: now + 60 * 60_000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

const SYSTEM_PROMPT = `Você é um QA Engineer Sênior. Gere casos de teste no formato EXATO abaixo. Qualquer desvio tornará os cenários inutilizáveis.

## FORMATO OBRIGATÓRIO — reproduza EXATAMENTE para cada cenário

Cenário: Nome do cenário aqui
Descrição: Texto descrevendo o que o cenário valida (obrigatório, escreva na mesma linha)
Regra de negócio: Regra relevante ou "Não informado"
Pré-condições:
- Pré-condição 1
- Pré-condição 2
BDD (Gherkin):
DADO que o usuário está na tela
QUANDO ele executa a ação
ENTÃO o sistema deve responder
Resultado esperado:
- Resultado 1
- Resultado 2

---

## REGRAS CRÍTICAS — violá-las gera erro de importação

1. SEMPRE escreva "Descrição:" com o texto NA MESMA LINHA. Exemplo:
   CORRETO:   Descrição: O sistema valida o campo obrigatório
   INCORRETO: Descrição:
              O sistema valida o campo obrigatório

2. SEMPRE escreva "Resultado esperado:" seguido dos bullets na linha de baixo. Exemplo:
   CORRETO:   Resultado esperado:
              - O sistema exibe mensagem de sucesso
   INCORRETO: Resultado esperado: O sistema exibe mensagem de sucesso

3. NÃO use asteriscos, negrito ou markdown em nenhum rótulo. Escreva texto puro.
   INCORRETO: **Descrição:** texto  |  **Resultado esperado:**
   CORRETO:   Descrição: texto      |  Resultado esperado:

4. Os 6 campos na ordem exata: Cenário → Descrição → Regra de negócio → Pré-condições → BDD (Gherkin) → Resultado esperado

5. Separar CADA cenário com "---" (inclusive o último)

6. NÃO escreva nenhum texto fora dos cenários (sem introdução, sem conclusão, sem numeração, sem headings)

7. Comece DIRETAMENTE com "Cenário:" — a primeira palavra da resposta deve ser "Cenário:"

## COBERTURA
- Fluxo feliz (caminho principal)
- Validações de campos obrigatórios
- Regra de negócio crítica
- Cenário de erro

## EXEMPLO COMPLETO

Cenário: Usuário realiza login com credenciais válidas
Descrição: Verifica que o sistema autentica o usuário e redireciona para o painel
Regra de negócio: Somente usuários ativos podem acessar o sistema
Pré-condições:
- Usuário cadastrado e ativo no sistema
- Navegador com acesso à aplicação
BDD (Gherkin):
DADO que o usuário está na tela de login
QUANDO ele informa e-mail e senha válidos e clica em Entrar
ENTÃO o sistema deve autenticar e redirecionar para o painel principal
Resultado esperado:
- O login é realizado com sucesso
- O usuário é redirecionado para o painel
- O nome do usuário é exibido no cabeçalho

---`

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

  const GOOGLE_MODEL_FALLBACKS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
  ]
  const GOOGLE_API_VERSIONS = ["v1beta", "v1"] as const

  function normalizeGoogleModelId(rawModel: string): string {
    const trimmed = rawModel.trim()
    if (!trimmed) return ""
    const noPrefix = trimmed.replace(/^models\//i, "")
    const noProviderPrefix = noPrefix.toLowerCase().startsWith("google/") ? noPrefix.slice("google/".length) : noPrefix
    return noProviderPrefix.replace(/:free$/i, "").trim()
  }

  function buildGoogleModelCandidates(rawModel: string): string[] {
    const first = normalizeGoogleModelId(rawModel)
    const candidates = [first, ...GOOGLE_MODEL_FALLBACKS]
    const seen = new Set<string>()
    const unique: string[] = []
    for (const item of candidates) {
      const normalized = normalizeGoogleModelId(item)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      unique.push(normalized)
    }
    return unique
  }

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

  const candidateModels = buildGoogleModelCandidates(model)
  let res: Response | null = null
  let lastStatus = 502
  let lastError = ""

  for (const candidateModel of candidateModels) {
    for (const version of GOOGLE_API_VERSIONS) {
      const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${candidateModel}:streamGenerateContent?alt=sse&key=${apiKey}`
      const attempt = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: userParts }],
          generationConfig: { maxOutputTokens: 8192 },
        }),
      })

      if (attempt.ok) {
        res = attempt
        break
      }

      const errText = await attempt.text()
      let errMessage = errText
      let errCode: number | undefined
      let errStatus: string | undefined
      try {
        const errJson = JSON.parse(errText) as { error?: { code?: number; message?: string; status?: string } }
        errCode = errJson.error?.code
        errStatus = errJson.error?.status
        errMessage = errJson.error?.message || errText
      } catch {
        // keep raw text
      }

      if (attempt.status === 429 || errCode === 429) {
        return new Response("Cota excedida no Google Gemini (Free Tier). Por favor, aguarde alguns segundos ou utilize outro motor de IA (como Llama 3.1).", { status: 429 })
      }

      if (attempt.status === 401 || errCode === 401) {
        return new Response("Chave Google inválida ou sem permissão para o Gemini.", { status: 401 })
      }

      const isModelNotFound =
        attempt.status === 404 ||
        errCode === 404 ||
        errStatus === "NOT_FOUND" ||
        /not found/i.test(errMessage)

      if (isModelNotFound) {
        lastStatus = 404
        lastError = errMessage
        continue
      }

      return new Response(`Erro na API Google Gemini: ${errMessage}`, { status: attempt.status })
    }
    if (res) break
  }

  if (!res) {
    const configuredModel = normalizeGoogleModelId(model) || model
    const suggested = candidateModels.join(", ")
    return new Response(
      `Erro na API Google Gemini: não foi possível usar o modelo configurado "${configuredModel}". ` +
      `Modelos tentados: ${suggested}. Detalhe: ${lastError || "modelo não disponível para esta chave/API."}`,
      { status: lastStatus }
    )
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

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  let body: {
    context?: string
    jira?: string
    prompt?: string
    imagens?: { dataUrl: string; name: string }[]
    integrationId?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response("Corpo da requisição inválido (JSON esperado).", { status: 400 })
  }

  const imagens = Array.isArray(body.imagens) ? body.imagens : undefined
  const integrationId =
    typeof body.integrationId === "string" ? body.integrationId.trim() : ""
  const ctx = typeof body.context === "string" ? body.context.trim() : ""
  const leg = typeof body.jira === "string" ? body.jira.trim() : ""
  const pr = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const jira = ctx || leg || pr

  const rateUserId = session.user.id ?? session.user.email ?? "session"
  if (!checkGeradorRateLimit(rateUserId)) {
    return new Response("Limite de geração atingido (30/hora). Aguarde antes de tentar novamente.", { status: 429 })
  }

  if (!integrationId) {
    return new Response("Nenhum modelo de IA selecionado. Recarregue a página e tente novamente.", { status: 400 })
  }

  if (!jira && (!imagens || imagens.length === 0)) {
    return new Response(
      "Informe ao menos uma entrada: texto no campo Contexto, anexos (imagem/PDF) ou carregue uma issue do Jira com sucesso (URL/chave + integração Jira em Configurações).",
      { status: 400 },
    )
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
  // Normalize provider aliases saved as "Gemini", "Open Router", etc.
  const provider = normalizeProvider(integracao.provider)

  if (!provider) {
    return new Response(
      `Provedor não suportado: "${integracao.provider}". Use Google (Gemini), OpenRouter, OpenAI, Anthropic ou Groq.`,
      { status: 400 }
    )
  }

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
  }
}
