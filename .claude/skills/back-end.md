---
name: back-end
description: Back-end para APIs, arquitetura e integrações. Use esta skill SEMPRE que precisar criar endpoints, services, repositories, handlers, middlewares, validações, autenticação, ou qualquer lógica de servidor. Também acione para modelagem de dados, integração com serviços externos, queries Prisma e Server Actions.
---

# Back-end

Seguro, testável e observável. Nenhum dado entra sem validação.

> ⚠️ **Next.js com breaking changes** — leia `node_modules/next/dist/docs/` antes de escrever qualquer código de servidor.

---

## Stack

- **API**: Route Handlers (`app/api/`) ou Server Actions (`actions.ts`)
- **ORM**: Prisma + PostgreSQL | **Auth**: Auth.js v5 — `auth()` para sessão
- **Validação**: Zod v4 | **Email**: Resend | **Pagamentos**: Stripe SDK

| Use Route Handler quando | Use Server Action quando |
|---|---|
| API pública ou webhook | Mutation de formulário/botão |
| Integração com serviço externo | Revalidação de cache |
| Precisa de headers/streaming | Ação acionada pelo cliente |

---

## Arquitetura (Clean Architecture)

```
Route Handler / Server Action → valida com Zod
    ↓
Service Layer   ← lógica de negócio pura
    ↓
Repository Layer ← queries Prisma isoladas
```

Regras rígidas: sem Prisma em services, sem lógica de negócio em handlers, sem queries fora de repositories.

---

## Segurança (Obrigatório em Todo Endpoint)

```typescript
// 1. Auth — sempre primeiro
const session = await auth()
if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 2. Validação — antes de qualquer operação
export const schema = z.object({ ... }) // SEMPRE exporte para o Front-end reutilizar
const result = schema.safeParse(await request.json())
if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
```

Regras obrigatórias:
- Nunca expor stack traces ao cliente — só logar server-side
- Nunca logar dados sensíveis (senhas, tokens, CPF)
- Sanitizar campos antes de persistir; nunca interpolar SQL
- Rate limiting em endpoints públicos e de autenticação
- Audit log em operações críticas (quem fez o quê, quando)

---

## Formato de Erro (Padrão Único)

```typescript
// Retorno consistente em TODOS os endpoints
return NextResponse.json(
  { error: { code: 'VALIDATION_ERROR', message: 'Descrição legível', details: [] } },
  { status: 400 }
)

// No catch, sempre logar antes de retornar
} catch (error) {
  console.error('[Handler:NomeDoEndpoint]', { requestId, error })
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } }, { status: 500 })
}
```

Códigos de status: validação → 400 / não autenticado → 401 / sem permissão → 403 / não encontrado → 404 / servidor → 500

---

## Prisma: Boas Práticas

- **Sempre** `select` ou `include` explícito — nunca retornar objeto completo
- Transações para operações múltiplas: `prisma.$transaction([])`
- Índices em campos usados em `where`/`orderBy`
- Paginação obrigatória em listagens (cursor ou offset com limite máximo)
- Migrations via `npm run db:migrate` — nunca `db push` em produção

---

## Observabilidade

```typescript
console.log(JSON.stringify({ event: 'user.created', userId, requestId, duration: Date.now() - start }))
```

- `requestId` em todo log para rastreabilidade
- Logar início + fim de chamadas externas (Stripe, email) com duração e resultado
- Nunca logar PII

---

## Resiliência & Idempotência

- Timeout explícito em toda chamada externa
- Retry com backoff exponencial para erros transitórios (5xx, timeout)
- Operações críticas (pagamento, email) devem usar chave de idempotência para evitar efeito duplo

---

## Checklist antes de entregar

- [ ] Satisfaz os **Critérios de Aceite (BDDs)** do QA Pré?
- [ ] Auth verificada + schema Zod exportado?
- [ ] Dados sensíveis fora do retorno (select explícito)?
- [ ] Todos os erros logados com `requestId` e formato padronizado?
- [ ] Sem lógica de negócio no handler, sem Prisma no service?
- [ ] Chamadas externas com timeout + idempotência onde necessário?
- [ ] TypeScript sem `any` não justificado?
