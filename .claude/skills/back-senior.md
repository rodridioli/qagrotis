---
name: back-senior
description: Backend Senior para APIs, arquitetura e integrações. Use esta skill SEMPRE que precisar criar endpoints, services, repositories, handlers, middlewares, validações, autenticação, ou qualquer lógica de servidor. Também acione para modelagem de dados, integração com serviços externos, queries Prisma e Server Actions.
---

# Backend Senior

Seguro, testável e observável. Nenhum dado entra sem validação.

---

## Stack

- **API**: Route Handlers (`app/api/`) ou Server Actions (`actions.ts`)
- **ORM**: Prisma + PostgreSQL
- **Auth**: Auth.js v5 (`next-auth`) — `auth()` para sessão, `signIn/signOut` para fluxos
- **Validação**: Zod v4 — obrigatório em toda entrada externa
- **Email**: Resend + Nodemailer
- **Pagamentos**: Stripe SDK

---

## Arquitetura (Clean Architecture)

```
Route Handler / Server Action
    ↓ valida com Zod
Service Layer          ← lógica de negócio
    ↓
Repository Layer       ← acesso ao banco (Prisma)
    ↓
Prisma Client
```

- Handlers/Actions: apenas orquestram (valida → chama service → retorna resposta)
- Services: lógica de negócio pura, sem acesso direto ao banco
- Repositories: queries Prisma isoladas, reutilizáveis
- Sem lógica de negócio em Route Handlers
- Sem queries Prisma fora de repositories

---

## Segurança (Obrigatório em Todo Endpoint)

### Autenticação e Autorização
```typescript
const session = await auth()
if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// verificar permissão específica se aplicável
```

### Validação de Entrada (Zod v4)
```typescript
const schema = z.object({ ... })
const result = schema.safeParse(await request.json())
if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
```

### Regras de Segurança
- Nunca expor stack traces em produção (`process.env.NODE_ENV !== 'production'`)
- Nunca logar dados sensíveis (senhas, tokens, CPF, etc.)
- Sanitizar strings antes de usar em queries dinâmicas
- Usar Prisma parameterized queries (nunca interpolação SQL)
- Headers de segurança via `next.config.js`
- Rate limiting em endpoints públicos e de autenticação
- CSRF protegido automaticamente por Server Actions; Route Handlers precisam verificar `Origin`

---

## Tratamento de Erros

```typescript
// Padrão de retorno consistente
type ApiResponse<T> = { data: T; error: null } | { data: null; error: string }

// Em Route Handlers
try {
  // ...
} catch (error) {
  console.error('[NomeDoHandler]', error) // log estruturado
  return NextResponse.json({ data: null, error: 'Erro interno' }, { status: 500 })
}
```

- Nunca deixar erro não tratado subir para o cliente
- Distinguir erros de validação (400) / auth (401/403) / not found (404) / server (500)
- Mensagens de erro para o cliente: amigáveis e sem informação interna

---

## Prisma: Boas Práticas

- Sempre usar `select` ou `include` explícitos — nunca retornar o objeto completo
- Transações para operações múltiplas relacionadas: `prisma.$transaction([])`
- Índices no schema para campos filtrados/ordenados com frequência
- Migrations via `npm run db:migrate` — nunca `db push` em produção
- Evitar N+1: usar `include` ou fazer batch queries
- Paginação obrigatória em listagens (cursor ou offset com limite máximo)

---

## Observabilidade

- Log estruturado em toda operação relevante:
  ```typescript
  console.log(JSON.stringify({ event: 'user.created', userId, timestamp: new Date() }))
  ```
- Log de erro com contexto (nunca `console.error(error)` sem identificação)
- Medir latência de operações críticas
- Logar chamadas a serviços externos (Stripe, email) com resultado

---

## Resiliência

- Timeout em chamadas externas (Stripe, email, webhooks)
- Retry com backoff exponencial para falhas transitórias
- Validar webhooks com assinatura (ex: `stripe.webhooks.constructEvent`)
- Idempotência em operações críticas (usar idempotency key ou verificação prévia)

---

## Server Actions vs Route Handlers

| Usar Route Handler quando... | Usar Server Action quando... |
|------------------------------|------------------------------|
| API pública / webhook        | Mutation de formulário       |
| Integração externa           | Ação de botão no cliente     |
| Precisa de streaming         | Revalidação de cache         |

---

## Checklist antes de entregar

- [ ] Toda entrada validada com Zod
- [ ] Autenticação verificada antes de qualquer operação
- [ ] Sem dados sensíveis no retorno
- [ ] Errors tratados e logados
- [ ] Queries Prisma com `select` explícito
- [ ] Sem lógica de negócio em handler
- [ ] TypeScript strict (sem `any` não justificado)
- [ ] Testável (lógica isolada em services)
