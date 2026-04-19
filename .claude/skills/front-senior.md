---
name: front-senior
description: Frontend Senior para implementação de interfaces em Next.js/React. Use esta skill SEMPRE que precisar implementar componentes, páginas, formulários, tabelas, modais ou qualquer elemento visual. Também acione para refatorar componentes existentes, corrigir bugs visuais ou garantir aderência ao Design System.
---

# Frontend Senior

Toda UI nasce do Design System. Sem exceção.

---

## Design System (Fonte Única de Verdade)

### Tokens
- Arquivo: `design-system/tokens.json`
- Gerar CSS: `npm run tokens`
- Validar: `npm run tokens:check`

### Regra de uso
- **Todo** valor de cor, espaçamento, tipografia, borda e sombra usa token CSS (`var(--token-name)`)
- Tailwind é permitido **somente** para aplicar tokens — nunca valores literais (`text-[#123]`, `p-[14px]` são proibidos)
- Se o token não existir → adicionar em `design-system/tokens.json` → rodar `npm run tokens` → depois usar

### Proibido
❌ Valores hardcoded de cor, tamanho ou fonte  
❌ CSS inline com valores literais (`style={{ color: '#fff' }}`)  
❌ Classes Tailwind com valores arbitrários sem token (`bg-[#abc]`, `text-[13px]`)

---

## Fluxo de Implementação

1. Verificar se o componente já existe (shadcn / @base-ui / Design System próprio)
2. Se existir: usar e estender via variante — nunca recriar
3. Se não existir:
   - Criar componente em `components/`
   - Criar story em `*.stories.tsx`
   - Usar apenas tokens do Design System
4. Implementar todos os estados UX (ver abaixo)
5. Validar acessibilidade
6. Validar responsividade (mobile-first)

---

## Estados UX Obrigatórios

Todo componente/tela que busca dados deve ter:

| Estado  | Implementação                                      |
|---------|----------------------------------------------------|
| loading | Skeleton com dimensões realistas (sem spinner nu)  |
| erro    | Mensagem amigável + botão de retry                 |
| vazio   | Ilustração/ícone + texto orientativo + CTA         |
| sucesso | Toast via `sonner` com mensagem consistente        |

---

## Performance

- Server Components por padrão — `'use client'` só quando necessário
- `React.memo` / `useMemo` / `useCallback` somente onde há custo mensurável
- Lazy loading para rotas e componentes pesados (`dynamic()` do Next.js)
- `AbortController` em fetches canceláveis
- Debounce em inputs de busca (300ms)
- Evitar re-renders: não passar objetos/arrays literais como prop

---

## Acessibilidade (WCAG 2.1 AA — Obrigatório)

- Semântica HTML correta (`button` para ação, `a` para navegação, etc.)
- `aria-label` em elementos sem texto visível
- `aria-live` em regiões que mudam dinamicamente
- Focus trap em modais e drawers
- Navegação completa por teclado
- Contraste mínimo 4.5:1 (texto normal) / 3:1 (texto grande)
- Não depender apenas de cor para transmitir informação

---

## Padrões Next.js App Router

- `page.tsx` — entrada da rota (Server Component)
- `_components/` — componentes privados da rota
- `loading.tsx` — skeleton de rota (Suspense automático)
- `error.tsx` — error boundary da rota
- `actions.ts` — Server Actions (mutations)
- Busca de dados em Server Components com `fetch` ou Prisma direto
- Mutations via Server Actions com `revalidatePath` / `revalidateTag`
- React Query v5 apenas para estado client-side e cache otimista

---

## Componentes: Checklist antes de entregar

- [ ] Usa apenas tokens do Design System (sem hardcode)
- [ ] Tem story no Storybook (`*.stories.tsx`)
- [ ] Implementa loading / erro / vazio / sucesso
- [ ] Responsivo mobile-first
- [ ] Acessível (teclado + screen reader + contraste)
- [ ] TypeScript strict (sem `any` não justificado)
- [ ] Sem `console.log` ou código de debug
- [ ] Nomes de componente, prop e variável expressivos

---

## Storybook

Todo componente reutilizável deve ter:
```tsx
// ComponentName.stories.tsx
export default { title: 'Categoria/ComponentName', component: ComponentName }
export const Default = { args: { ... } }
export const Loading = { args: { isLoading: true } }
export const Empty = { args: { data: [] } }
export const Error = { args: { error: 'Mensagem de erro' } }
```
