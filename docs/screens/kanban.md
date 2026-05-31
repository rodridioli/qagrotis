# Tela: Kanban UX

<!-- gerado por: reviewer | atualizado: 2026-05-30 -->

**Rota:** `/kanban` e `/kanban/usuario/[userId]`  
**Acesso:** Usuários com capability `menu.kanban` (Padrão:UX, Administrador:UX, Administrador:MGR)  
**Arquivo:** `src/app/(protected)/kanban/`

## Descrição

Board Kanban para o time UX. Exibe sub-tarefas Jira organizadas em colunas por status, com suporte a arrastar e soltar, filtro por membro, busca e raias por assignee.

A rota `/kanban/usuario/[userId]` exibe o kanban pessoal de um usuário específico com timer de horas integrado ao Clockwork Pro.

## Componentes

| Componente | Arquivo |
|---|---|
| Página principal (SSR) | `src/app/(protected)/kanban/page.tsx` |
| Board UX | `src/app/(protected)/kanban/UxKanbanClient.tsx` |
| Board genérico | `src/app/(protected)/kanban/KanbanClient.tsx` |
| Página por usuário (SSR) | `src/app/(protected)/kanban/usuario/[userId]/page.tsx` |
| Board por usuário (client) | `src/app/(protected)/kanban/usuario/[userId]/UserKanbanClient.tsx` |

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

## Timer de Horas (Kanban por Usuário)

O board pessoal (`/kanban/usuario/[userId]`) integra o Clockwork Pro para exibição de horas lançadas por card.

### Fluxo
1. Ao montar, `getClockworkTotalsForCards(allIssueKeys)` é chamado para buscar o total de segundos postados no Clockwork para cada card visível.
2. O resultado fica em `clockworkTotals: Record<string, number>` no state do componente.
3. O timer exibido no card soma o **total Clockwork** com o **elapsed da sessão ativa local** (quando o card está em "Em andamento").
4. O botão `RefreshCw` ao lado do timer recarrega o total Clockwork apenas para aquele card (`getClockworkTotalsForCards([issueKey])`).

### Regras de exibição do timer
| Condição | Exibição |
|---|---|
| `clockworkTotal > 0`, sem sessão ativa | Mostra total Clockwork estático |
| `clockworkTotal > 0` + sessão ativa | Mostra total Clockwork + elapsed (incrementa a cada segundo) |
| `clockworkTotal == 0` + sessão ativa | Mostra apenas elapsed (incrementa a cada segundo) |
| `clockworkTotal == 0`, sem sessão ativa | Timer não exibido |

### Server Actions
| Action | Localização |
|---|---|
| `startCardTimer(issueKey, summary)` | `src/features/kanban/actions/clockwork-timer.ts` |
| `stopCardTimer(issueKey)` | `src/features/kanban/actions/clockwork-timer.ts` |
| `getActiveTimersForCards(issueKeys[])` | `src/features/kanban/actions/clockwork-timer.ts` |
| `getClockworkTotalsForCards(issueKeys[])` | `src/features/kanban/actions/clockwork-timer.ts` |
| `fetchClockworkTotalForIssue({ token, issueKey })` | `src/features/qa/lib/clockwork-worklogs-fetch.ts` |

### Banco de dados
Sessões de timer persistidas em `kanban_timer_sessions` (Prisma). Campo `accumulatedSeconds` armazena segundos de sessões encerradas; `startedAt` indica sessão ativa.

## Ícones de Prioridade

Cards exibem ícones de prioridade via componente local `PriorityIcon` (lucide-react). Sem requisição externa ao Jira.

| Prioridade | Ícone | Cor |
|---|---|---|
| highest / critical | `ChevronsUp` | `text-red-500` |
| high | `ChevronUp` | `text-orange-500` |
| medium | `Equal` | `text-yellow-500` |
| low | `ChevronDown` | `text-blue-400` |
| lowest | `ChevronsDown` | `text-text-secondary` |

## Observações

- A página é `force-dynamic` — sem cache SSR.
- Redireciona para `/dashboard` se o usuário não tiver a capability `menu.kanban`.
- `fetchClockworkTotalForIssue` consulta apenas a primeira página de worklogs — para issues com histórico muito longo (>10 000 registros) o total pode ser subestimado.
- `getClockworkTotalsForCards` não limita o tamanho do array — para boards com muitos cards (>80), considerar paginação das chamadas Clockwork.
