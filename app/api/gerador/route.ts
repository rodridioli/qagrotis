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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY não configurada.", { status: 500 })
  }

  const { jira, contexto, imagens } = await req.json() as {
    jira?: string
    contexto?: string
    imagens?: string
  }

  if (!jira && !contexto && !imagens) {
    return new Response("Informe ao menos uma entrada.", { status: 400 })
  }

  const parts: string[] = []
  if (jira)     parts.push(`## JIRA (copiado)\n${jira}`)
  if (contexto) parts.push(`## Contexto adicional\n${contexto}`)
  if (imagens)  parts.push(`## Descrição de telas/imagens\n${imagens}`)
  const userMessage = parts.join("\n\n")

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text()
    return new Response(`Erro na API Anthropic: ${err}`, { status: 502 })
  }

  // Stream SSE from Anthropic → client as plain text stream
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader()
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
          } catch {
            // ignore malformed chunks
          }
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
