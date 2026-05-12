# Tela: Dashboard

**Rota:** `/dashboard`  
**Acesso:** Todos os usuários autenticados  
**Arquivo:** `src/app/(protected)/dashboard/`

## Descrição

Página inicial após o login. Exibe visão geral do estado do QA: estatísticas de cenários, suítes e progresso da equipe.

## Conteúdo esperado

- Contagem de cenários ativos/inativos
- Contagem de suítes por situação
- Atividade recente

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Spinner via `loading.tsx` existente |
| Erro | `error.tsx` com reset |

## RBAC

- Acessível a todos os usuários autenticados
- Conteúdo pode variar por `accessProfile`
