# Tela: Cenários

**Rota:** `/cenarios`  
**Acesso:** Todos os usuários autenticados  
**Componente principal:** `src/app/(protected)/cenarios/CenariosClient.tsx`

## Descrição

Lista todos os cenários de teste cadastrados. Permite filtrar, buscar, criar, editar, inativar e reativar cenários.

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de linhas animadas via `loading.tsx` |
| Vazio | `EmptyState` com ícone ClipboardList + botão "Criar Cenário" (admin) |
| Com dados | Tabela paginada com ordenação por ID |
| Erro | `error.tsx` com botão "Tentar novamente" |

## Ações disponíveis

| Ação | Acesso | Descrição |
|------|--------|-----------|
| Criar cenário | Todos | Navega para `/cenarios/novo` |
| Editar cenário | Todos | Navega para `/cenarios/[id]/editar` |
| Inativar cenário | Todos | Soft-delete, remove da lista padrão |
| Reativar cenário | Admin | Visível ao filtrar "Exibir inativos" |
| Inativar em massa | Todos | Via checkboxes + botão bulk |
| Importar Markdown | Todos | Upload de arquivo `.md` com cenários |
| Filtrar por módulo/cliente/tipo | Todos | Painel de filtros lateral |

## Filtros

- **Busca**: por nome, ID, módulo, cliente
- **Filtro de módulo**: dropdown com módulos ativos
- **Filtro de cliente**: dropdown com clientes ativos
- **Filtro de tipo**: Manual, Automatizado, Misto
- **Exibir inativos**: toggle (admin apenas)

## Validações

- Objetivo obrigatório para tipo "Automatizado" e "Manual Automatizável"
- Sistema/Módulo obrigatório (deve estar ativo)
- Nome do cenário: máximo 300 caracteres

## RBAC

- `can(role, 'menu.cenarios')` — visibilidade no menu
- Botão "Reativar" renderizado apenas para `isAdmin`
- Botão "Criar Cenário" no EmptyState renderizado apenas para `isAdmin`

## Rotas relacionadas

- `/cenarios/novo` — criação de cenário
- `/cenarios/[id]/editar` — edição de cenário
