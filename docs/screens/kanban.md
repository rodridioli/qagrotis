# Tela: Kanban UX

**Rota:** `/kanban`  
**Acesso:** Usuários com capability `menu.kanban` (Padrão:UX, Administrador:UX, Administrador:MGR)  
**Arquivo:** `src/app/(protected)/kanban/`

## Descrição

Board Kanban para o time UX. Exibe sub-tarefas Jira organizadas em colunas por status, com suporte a arrastar e soltar, filtro por membro, busca e raias por assignee.

## Componentes

| Componente | Arquivo |
|---|---|
| Página (SSR) | `src/app/(protected)/kanban/page.tsx` |
| Board UX | `src/app/(protected)/kanban/UxKanbanClient.tsx` |
| Board genérico | `src/app/(protected)/kanban/KanbanClient.tsx` |

## Dados carregados (SSR)

| Dado | Action |
|---|---|
| Sub-tarefas Jira | `getKanbanSubtasks()` |
| Membros da equipe UX | `getEquipeMembrosParaLancamentosComInativos("UX")` |
| Atribuições de cards | `getKanbanAssignments()` |
| Tarefas UX (Issues issuetype=UX) | `getUxTarefas()` |

## RBAC

| Capability | Roles |
|---|---|
| `menu.kanban` | Padrão:UX, Administrador:UX, Administrador:MGR |

## Estados

| Estado | Comportamento |
|---|---|
| Jira não configurado | Exibe card de aviso com link para configurações |
| Sem issues | Colunas vazias com empty state |
| Loading | Skeleton de colunas |
| Erro de fetch | Toast de erro |

## Colunas do Board

Definidas em `src/features/kanban/kanban-constants.ts`. Seguem os status Jira mapeados para o fluxo UX (Backlog, Em Andamento, Em Revisão, Concluído, etc.).

## Observações

- A página é `force-dynamic` — sem cache SSR.
- Redireciona para `/dashboard` se o usuário não tiver a capability `menu.kanban`.
