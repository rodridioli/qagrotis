# Tela: Suítes

**Rota:** `/suites`  
**Acesso:** Todos os usuários autenticados  
**Componente principal:** `src/app/(protected)/suites/`

## Descrição

Lista todas as suítes de teste. Permite criar, editar, registrar resultados de execução, encerrar/reabrir e exportar evidências.

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton via `loading.tsx` |
| Vazio | `EmptyState` genérico |
| Com dados | Tabela paginada com situação (Planejada / Em andamento / Concluída) |
| Erro | `error.tsx` com reset |

## Ações disponíveis

| Ação | Acesso | Descrição |
|------|--------|-----------|
| Criar suíte | Todos | Navega para `/suites/nova` |
| Editar suíte | Todos (não encerrada) | Edição inline de nome/cenários |
| Registrar resultado | Todos | Por cenário: Sucesso / Alerta / Erro |
| Encerrar suíte | Todos | Muda status para "Concluída" |
| Reabrir suíte | Admin | Reverte status de "Concluída" |
| Inativar suíte | Todos | Soft-delete |
| Reativar suíte | Admin | Visível com filtro "Exibir inativos" |
| Exportar Markdown | Todos | Gera relatório da suíte |
| Exportar Jira | Todos | Modal com campos de integração Jira |

## Validações

- Suíte deve ter pelo menos 1 cenário
- Resultado "Alerta" requer observação
- Suítes encerradas não podem ser editadas

## Filtros

- **Situação**: Planejada / Em andamento / Concluída
- **Busca**: por ID, nome
- **Exibir inativos**: toggle (admin)

## RBAC

- `can(role, 'menu.suites')` — visibilidade no menu
- Botões "Reativar" e "Reabrir" apenas para `isAdmin`

## Rotas relacionadas

- `/suites/nova` — criar suíte
- `/suites/[id]` — detalhe/execução da suíte
- `/suites/[id]/[cenarioId]` — execução individual de cenário
