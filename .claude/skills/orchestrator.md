---
name: orchestrator
description: Orquestrador Fullstack — pipeline obrigatório de engenharia que coordena UX, QA pré, Back, Front, QA pós e Reviewer. Use esta skill quando o usuário pedir para implementar uma feature completa ou quando a tarefa envolve múltiplas camadas (UI + API + banco). Acione também para auditorias técnicas e refatorações completas.
---

# Orquestrador Fullstack

**[REGRA DE OURO]: Execute UMA etapa por vez.** Entregue, pare e aguarde aprovação explícita do usuário antes de avançar. Nunca encadeie etapas automaticamente.

---

## Stack do Projeto

- **Framework**: Next.js 16 App Router | **UI**: React 19 + TypeScript + Tailwind v4 + shadcn + @base-ui/react
- **Design System**: `design-system/tokens.json` → `npm run tokens` / `npm run tokens:check`
- **Banco**: Prisma + PostgreSQL | **Auth**: Auth.js v5 | **Validação**: Zod v4
- **Data fetching**: TanStack React Query v5 | **Testes**: Vitest + Playwright | **Docs**: Storybook 10

---

## Antes de Iniciar

Se o requisito estiver ambíguo, faça **no máximo 3 perguntas objetivas** e aguarde resposta antes de iniciar qualquer etapa. Não assuma — implementar errado custa mais do que perguntar.

---

## Pipeline

```
1. ux-senior    → experiência, estados, componentes
2. qa-senior    → BDDs, critérios de aceite, riscos (FASE PRÉ)
3. back-senior  → API, Zod schemas exportados, Clean Architecture
4. front-senior → UI consumindo schemas do Back + UI Checker Gate
5. qa-senior    → integração, testes automatizados (FASE PÓS)
6. reviewer     → segurança, qualidade, documentação
```

**Se o usuário pedir para pular uma fase**: explique o risco específico e proponha versão simplificada — mas não elimine.

---

## Protocolo por Fase

Anuncie o início de cada fase:
> `"▶ Fase [N] — [Nome]. [Uma linha do que será entregue]..."`

Sinalize bloqueios imediatamente — não avance com problemas em aberto.

### Fase 1 — ux-senior
Fluxo do usuário, wireframe com tokens semânticos, todos os estados (loading/erro/vazio/sucesso/bloqueado), interações, acessibilidade, copywriting e lista de componentes (existentes vs a criar).

### Fase 2 — qa-senior (PRÉ)
Cenários BDD (happy path + alternativos + borda), critérios de aceite verificáveis, riscos identificados.

### Fase 3 — back-senior
Route Handlers/Server Actions com auth, Zod schemas **exportados** para o Front, Clean Architecture, logs estruturados, erros padronizados.

### Fase 4 — front-senior
UI consumindo schemas e APIs do Back. Responsividade, acessibilidade, performance. **UI Checker Gate obrigatório ao final** — bloqueio se houver infrações.

### Fase 5 — qa-senior (PÓS)
Validação da integração Front ↔ Back, testes automatizados (Vitest + Playwright) cobrindo os BDDs da Fase 2. Não avance se houver bugs blockers.

### Fase 6 — reviewer
Auditoria de segurança (OWASP Top 10, IDOR), qualidade de código, consistência visual, documentação automática em `docs/`.

---

## Bloqueios Globais

❌ Hardcode visual (cor, espaçamento, tipografia)  
❌ Componente novo sem story no Storybook  
❌ API sem Zod ou sem `auth()`  
❌ IDOR, dado sensível no payload, select incompleto no Prisma  
❌ UI Checker Gate com falhas  
❌ Bugs blockers no QA Pós  

---

## Quando NÃO Usar

Tarefas isoladas (bugfix de backend, ajuste visual pontual) → use a skill específica diretamente. O pipeline completo é para features novas ou mudanças que cruzam múltiplas camadas.
