---
name: front-end
description: Front-end para implementação de interfaces em Next.js/React. Use esta skill SEMPRE que precisar implementar componentes, páginas, formulários, tabelas, modais ou qualquer elemento visual. Ela já inclui o Gate de UI Checker para validação visual estrita de Design System, acessibilidade e responsividade.
---

# Front-end (+ UI Checker Gate)

Toda UI nasce do Design System. Sem exceção.

> ⚠️ **Next.js com breaking changes** — leia `node_modules/next/dist/docs/` antes de escrever qualquer código de componente ou rota.

---

## Design System (Fonte Única de Verdade)

- Tokens em `design-system/tokens.json` → gerar: `npm run tokens` → validar: `npm run tokens:check`
- **Todo** valor de cor, espaçamento, tipografia, borda e sombra usa token CSS (`var(--token)` ou classe semântica Tailwind)
- Token não existe? → adicionar no JSON → rodar `npm run tokens` → então usar

❌ **Proibido**: valores hardcoded (`text-[#123]`, `p-[14px]`, `style={{ color: '#fff' }}`)

---

## Fluxo de Implementação

1. **Verificar DS primeiro** — buscar em `components/ui/` e `components/qagrotis/` antes de criar qualquer componente. Se existir, usar/estender via variante.
2. **Consumir Back-end** — usar os Schemas Zod e Server Actions/APIs exportados. Nunca recriar tipagens.
3. **Implementar todos os estados UX**: loading, erro, vazio, sucesso.
4. **Validar contra BDDs** do QA Pré antes de concluir.
5. **Executar UI Checker Gate** (obrigatório, ver ao final).

---

## Padrões de Componentes (Tolerância Zero)

### Formulários
- Submit com campos vazios: adicionar `border-destructive` no campo + `toast.error("Preencha os campos obrigatórios.")`.
- Botão de submissão **NÃO** é desabilitado. Texto de erro inline é **PROIBIDO**.
```tsx
if (emptyFields.length > 0) {
  setErrorFields(emptyFields)
  toast.error("Preencha os campos obrigatórios.")
  return
}
```

### Botões em Modais (Tolerância Zero)

Todo `<Button>` dentro de `<DialogFooter>` **DEVE** ter ícone à esquerda com `aria-hidden` e `className="gap-1.5"`.

| Tipo | variant | Ícone idle | Ícone loading |
|---|---|---|---|
| Cancelar | `outline` | `<X className="size-4 shrink-0" aria-hidden />` | — (não tem loading) |
| Confirmar/Salvar | `default` | `<Check className="size-4 shrink-0" aria-hidden />` | `<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />` |
| Destrutivo | `destructive` | `<Ban className="size-4 shrink-0" aria-hidden />` | `<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />` |

```tsx
// ✅ CORRETO — padrão obrigatório
<DialogFooter>
  <Button variant="outline" onClick={onClose} disabled={loading} className="gap-1.5">
    <X className="size-4 shrink-0" aria-hidden />
    Cancelar
  </Button>
  <Button type="submit" form="my-form" disabled={loading} className="gap-1.5">
    {loading ? (
      <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Salvando…</>
    ) : (
      <><Check className="size-4 shrink-0" aria-hidden />Salvar</>
    )}
  </Button>
</DialogFooter>

// ❌ PROIBIDO — botão sem ícone
<Button onClick={onClose}>Cancelar</Button>
<Button>{loading ? "Salvando..." : "Salvar"}</Button>
```

Referências canônicas no projeto: `EquipeAusenciasSection.tsx`, `ChapterScheduleDialog.tsx`, `OnboardingGate.tsx`

### Botão de Filtro (padrão único, nunca variar)
```tsx
// Copiar literalmente de TableToolbar.tsx — sem label ao lado do ícone
<button type="button" onClick={onOpen} aria-label="Abrir filtros"
  className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100">
  <SlidersHorizontal className="size-4" />
  {activeCount > 0 && (
    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-primary text-primary-foreground text-xs font-bold">
      {activeCount}
    </span>
  )}
</button>
```

### Tabelas
- Sem overflow de colunas: usar `truncate`, `max-w-*` ou `overflow-hidden`
- Container com `overflow-x-auto` para mobile

---

## Estados UX (Todos Obrigatórios)

| Estado  | Implementação |
|---------|---------------|
| loading | Skeleton com dimensões realistas — nunca spinner isolado em listas/cards |
| erro    | Mensagem amigável + botão de retry |
| vazio   | Ícone + texto orientativo + CTA |
| sucesso | Toast via `sonner` |

---

## Regra Global de Loading (Tolerância Zero)

### ❌ PROIBIDO — Loaders Simultâneos

Nunca renderizar mais de um loader visível ao mesmo tempo na mesma tela. Os cenários proibidos são:

```
Page Loader (loading.tsx)
  + Component Loader (if isLoading)
  + Widget Loader (if loading dashboard)
```

```
"Carregando..."   ← loader da rota
"Carregando dados..."   ← loader do componente   ← NUNCA os dois juntos
```

### ✅ OBRIGATÓRIO — Hierarquia de Loading

**Tela ainda não carregou** (dados necessários para renderização ausentes):
- Exibir apenas `<SectionSpinner />` ocupando o container principal
- O texto padrão é **"Carregando…"** — usar o default do componente, nunca sobrescrever

**Tela já carregada, conteúdo interno atualizando**:
- Usar skeleton local (`animate-pulse`) ou refresh silencioso
- Nunca mostrar spinner de página inteira

### Componente Oficial

```tsx
// CORRETO — usa o padrão do sistema
<SectionSpinner minHeight="min-h-[60vh]" />

// PROIBIDO — texto alternativo
<SectionSpinner label="Carregando dados..." />
<SectionSpinner label="Buscando informações..." />
<SectionSpinner label="Loading..." />
```

### Textos Proibidos em Loaders Globais

- ❌ "Carregando dados..."
- ❌ "Buscando informações..."
- ❌ "Obtendo registros..."
- ❌ "Loading..."
- ❌ Qualquer variação — apenas **"Carregando…"** (unicode, via default do `SectionSpinner`)

### Responsável Único pelo Loading

Cada tela deve ter **um único responsável** pelo estado de carregamento global:
- Se a rota tem `loading.tsx` → ele cobre o estado de carregamento da página
- O componente filho **não deve** exibir um segundo spinner global enquanto o `loading.tsx` ainda pode estar ativo
- Loaders locais (skeletons, spinners dentro de cards/botões) são permitidos APÓS a tela ter montado

### Checklist de Loading

- [ ] Nenhuma tela exibe dois spinners simultaneamente
- [ ] Nenhum `SectionSpinner` com `label` diferente de "Carregando…"
- [ ] Dashboards: loading.tsx cobre o carregamento inicial; estado interno usa min-h parcial sem sobrepor
- [ ] Ações de mutação (salvar, enviar, inativar): usar texto de ação específico no botão (`isPending ? "Salvando…" : "Salvar"`) ou `<LoadingOverlay>` — nunca spinner de página inteira

---

## Performance & Acessibilidade

**Performance:**
- Server Components por padrão; `'use client'` só com estado local ou eventos
- `dynamic()` para rotas e componentes pesados
- `useMemo`/`useCallback` só com necessidade comprovada por profiling — não defensivo
- Debounce 300ms em buscas + `AbortController` ao desmontar

**Acessibilidade:**
- Focus trap em modais + focus restore ao fechar (devolver foco ao elemento que abriu)
- `aria-live` em atualizações dinâmicas; `aria-label` em botões icon-only
- Navegação completa por teclado (Tab, Shift+Tab, Enter, Escape)
- Estado crítico: nunca dependa só de cor — use ícone + texto + cor juntos
- Contraste mínimo WCAG AA; legível em Dark Mode via tokens semânticos

---

## Storybook (Todo Componente Novo)

```tsx
export default { title: 'Categoria/Nome', component: Componente }
export const Default = { args: { ... } }
export const Loading = { args: { isLoading: true } }
export const Empty = { args: { data: [] } }
export const Error = { args: { error: 'Mensagem' } }
```

---

## Consistência Visual — Reutilização de Padrões (Regra Obrigatória)

Antes de construir qualquer nova tela, identifique a tela mais semelhante já existente e use-a como referência estrutural. Nunca inventar layouts, tabelas, toolbars ou modais quando já existe um padrão no projeto.

### É Proibido criar quando já existe equivalente:
- Novos padrões de tabela → usar `UsuariosClient.tsx` como referência para tabelas administrativas
- Novos padrões de toolbar → usar `TableToolbar.tsx`
- Novos padrões de filtro → usar `FilterState` + `Dialog` de `UsuariosClient.tsx`
- Novos layouts de página administrativa → usar `space-y-4` + header flex + card `rounded-xl bg-surface-card shadow-card overflow-hidden`
- Spinners inline em listas → usar skeleton `animate-pulse` em listas; `LoadingOverlay` para mutações
- Elementos `<select>` nativos → usar `<Select>` de `@/components/ui/select`

### Estrutura obrigatória para telas administrativas com tabela:

```tsx
<div className="space-y-4">
  {/* 1. Header: breadcrumb + ações */}
  <div className="flex flex-wrap items-center justify-between gap-2">
    <PageBreadcrumb items={[...]} />
    {/* botões de ação à direita quando aplicável */}
  </div>

  {/* 2. Card unificado: toolbar + tabela + empty state + paginação */}
  <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
    <TableToolbar ... />
    {items.length === 0 ? (
      <EmptyState message="..." />
    ) : (
      <>
        <div className="w-full overflow-x-auto">
          <table className="qagrotis-table-row-hover w-full min-w-[...] table-fixed text-sm">
            <colgroup>...</colgroup>
            <thead>
              <tr className="border-b border-border-default bg-neutral-grey-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">...</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-default last:border-0 transition-colors">...</tr>
            </tbody>
          </table>
        </div>
        <TablePagination ... />
      </>
    )}
  </div>
</div>
```

### Checklist de Consistência Visual (executar antes de concluir toda nova tela)

#### Estrutura
- [ ] Usa `space-y-4` + header flex externo + card `rounded-xl bg-surface-card shadow-card overflow-hidden`
- [ ] `<TableToolbar>` está **dentro** do card
- [ ] `<EmptyState>` está **dentro** do card
- [ ] `<TablePagination>` está **dentro** do card
- [ ] `<PageBreadcrumb>` está no header externo ao card

#### Tabela
- [ ] Tag `<table>` usa `qagrotis-table-row-hover w-full table-fixed`
- [ ] Usa `<colgroup>` com larguras definidas
- [ ] `<tr>` do `<thead>` tem `bg-neutral-grey-50` + `border-b border-border-default`
- [ ] `<th>` usa `text-xs font-semibold text-text-secondary`
- [ ] Container da tabela tem `w-full overflow-x-auto`
- [ ] `<tr>` do `<tbody>` tem `border-b border-border-default last:border-0 transition-colors`

#### Design System
- [ ] Zero hardcode — apenas tokens DS e classes semânticas Tailwind
- [ ] Nenhum `<select>` nativo — usar `<Select>` de `@/components/ui/select`
- [ ] Loading de lista: skeleton `animate-pulse h-12 rounded-xl bg-neutral-grey-100`, não spinner isolado
- [ ] Loading de mutação: `<LoadingOverlay>` ou spinner dentro do botão

### Processo de Revisão Obrigatório

Ao finalizar qualquer nova tela administrativa, declarar:
> **Tela de referência utilizada:** [nome da tela]
> **Diferenças encontradas:** [lista ou "nenhuma"]
> **Correções aplicadas:** [lista ou "n/a"]
> A nova tela segue integralmente os padrões visuais, componentes, espaçamentos, tipografia, responsividade e comportamento definidos pelo Design System da plataforma.

---

## 🛑 UI Checker Gate (Executar Antes de Concluir)

Revise o código implementado e marque cada item. **Corrija antes de entregar — não devolva código com infrações.**

- [ ] Zero hardcode — apenas tokens DS e classes semânticas Tailwind
- [ ] Componente verificado no DS antes de criar novo (`components/ui/` e `components/qagrotis/`)
- [ ] Superfícies: `bg-surface-card`, `bg-surface-input`, `bg-muted` (nunca hex/rgb)
- [ ] Sombras: `shadow-card` (nunca `shadow-md` ou `shadow-lg` sem token)
- [ ] Formulários: borda `border-destructive` + toast no submit, botão liberado
- [ ] Botão de filtro: padrão exato de `TableToolbar.tsx` (sem label, badge overlay)
- [ ] Todos os estados implementados: Skeleton (loading), erro+retry, vazio+CTA, sucesso toast
- [ ] Loading: apenas um responsável por tela; `<SectionSpinner />` sem `label` customizado; nunca dois loaders simultâneos
- [ ] Botões icon-only têm `aria-label`; modais com focus trap + restore
- [ ] Todos os `<Button>` em `<DialogFooter>` têm ícone à esquerda com `aria-hidden` e `gap-1.5`
- [ ] Mobile-first: estilos base para mobile, `sm:` para escalar
- [ ] Componentes novos documentados no Storybook (default, loading, erro, vazio)
