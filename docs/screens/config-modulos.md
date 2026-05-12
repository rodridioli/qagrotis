# Tela: Configurações — Módulos

**Rota:** `/configuracoes/modulos`  
**Acesso:** Todos os usuários autenticados (ações de escrita apenas admin)  
**Componente:** `src/app/(protected)/configuracoes/modulos/ModulosClient.tsx`  
**Server Actions:** `src/features/qa/actions/modulos.ts`

## Descrição

Gerencia os módulos que subdividem sistemas. Cada módulo pertence a um sistema ativo. Cenários são vinculados a módulos.

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de tabela via `loading.tsx` |
| Vazio | `EmptyState` com ícone Layers e mensagem "Nenhum módulo cadastrado ainda." |
| Com dados | Tabela com ID, nome, sistema pai |
| Erro | `error.tsx` com reset |

## Ações

| Ação | Acesso | Comportamento |
|------|--------|--------------|
| Criar módulo | Admin | Requer sistema ativo selecionado |
| Editar módulo | Admin | Renomeação propagada a cenários e suítes |
| Inativar módulo | Admin | Cascata: cenários e suítes vinculados |
| Inativar em massa | Admin | Todos com cascata |
| Reativar módulo | Admin | Apenas o módulo; cascata não é revertida |

## Filtros

- **Sistema**: dropdown para filtrar por sistema pai
- **Exibir inativos**: toggle (admin)

## RBAC

- `can(role, 'menu.configuracoes.modulos')` — visibilidade
- `requireAdmin()` em todas as mutações
