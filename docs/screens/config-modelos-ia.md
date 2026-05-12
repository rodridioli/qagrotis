# Tela: Configurações — Modelos de IA

**Rota:** `/configuracoes/modelos-de-ia`  
**Acesso:** Apenas administradores  
**Server Actions:** `src/features/integracoes/actions/integracoes.ts`

## Descrição

Gerencia as integrações com provedores de IA usados no Gerador de Cenários. Suporta Google (Gemini), OpenRouter, OpenAI, Anthropic e Groq.

## Provedores suportados

| Provedor | Normalização via `normalizeProvider()` |
|----------|---------------------------------------|
| Google / Gemini | `"google"` |
| OpenRouter | `"openrouter"` |
| OpenAI | `"openai"` |
| Anthropic | `"anthropic"` |
| Groq | `"groq"` |

## Segurança

- `apiKey` nunca é retornada em `getIntegracoesSafe()` (usado em contextos cliente)
- `getIntegracoes()` retorna apiKey — usar apenas em Server Components ou server actions

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton via `loading.tsx` |
| Vazio | `EmptyState` com mensagem orientando a criar integração |
| Com dados | Lista de modelos com provedor, modelo e status ativo/inativo |
| Erro | `error.tsx` com reset |

## Ações

| Ação | Acesso | Validações |
|------|--------|-----------|
| Criar integração | Admin | Provedor, modelo e API Key obrigatórios |
| Editar integração | Admin | API Key pode ser mantida ou substituída |
| Inativar integração | Admin | Soft-delete |
| Reativar integração | Admin | Visível com filtro |

## Cache

- Usa `updateTag(LAYOUT_CACHE_TAG)` e `revalidatePath()` após mutações
- Cache de layout é invalidado para atualizar o seletor de modelos no Gerador

## RBAC

- Tela visível apenas para administradores
- `requireAdmin()` em todas as mutações
