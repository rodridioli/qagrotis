---
name: orchestrator
description: Orquestrador Fullstack — pipeline obrigatório de engenharia que coordena UX, QA pré, Front, Back, QA pós e Review. Use esta skill quando o usuário pedir para implementar uma feature completa ou quando a tarefa envolve múltiplas camadas (UI + API + banco). Acione também para auditorias técnicas e refatorações completas.
---

# Orquestrador Fullstack

Pipeline obrigatório. Nenhuma etapa pode ser pulada.

---

## Stack do Projeto

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TypeScript + Tailwind v4 + shadcn + @base-ui/react
- **Design System**: `design-system/tokens.json` → `npm run tokens` / `npm run tokens:check`
- **Banco**: Prisma + PostgreSQL
- **Auth**: Auth.js v5 (next-auth beta)
- **Validação**: Zod v4
- **Data fetching**: TanStack React Query v5
- **Testes**: Vitest (unit/integration) + Playwright (E2E)
- **Documentação**: Storybook 10

---

## Pipeline Obrigatório

```
UX → QA (pré) → FRONT → BACK → QA (pós) → REVIEW
```

### Etapa 1 — UX Senior
- Mapear fluxo do usuário
- Definir estados: loading · erro · vazio · sucesso
- Estrutura da tela (wireframe descritivo)
- Padronizar textos, labels e mensagens
- Listar componentes necessários

### Etapa 2 — QA Senior (PRÉ)
- Criar cenários BDD (Given/When/Then)
- Definir critérios de aceite
- Identificar casos de borda e riscos

### Etapa 3 — Front Senior
- Implementar UI com tokens do Design System
- Usar shadcn/@base-ui como base
- Criar/atualizar story no Storybook
- Garantir responsividade, acessibilidade e performance

### Etapa 4 — Back Senior
- Implementar Route Handlers ou Server Actions
- Validar com Zod, autenticar com Auth.js v5
- Clean Architecture: handler → service → repository
- Logs estruturados e tratamento de erro

### Etapa 5 — QA Senior (PÓS)
- Validar integração front + back
- Executar testes: Vitest (unit/integration) + Playwright (E2E)
- Validar segurança (XSS, CSRF, injection)
- Validar performance (re-renders, payload, latência)

### Etapa 6 — Reviewer (Gate Final)
- Revisar código (qualidade, duplicação, anti-patterns)
- Validar UI consistency (tokens, spacing, typography)
- Auditoria de segurança (OWASP top 10)
- Aprovar ou bloquear

---

## Bloqueios Globais

❌ **PARA TUDO** se:
- Hardcode de cor, espaçamento ou tipografia (usar tokens)
- Componente novo sem story no Storybook
- API sem validação Zod
- Código sem tratamento de erro
- Falha em qualquer etapa do pipeline

---

## Regras Globais

- Nunca gerar código antes do UX definir a experiência
- Todo valor visual vem de `design-system/tokens.json`
- TypeScript strict — sem `any` sem justificativa
- Mobile-first obrigatório
- WCAG 2.1 AA obrigatório
