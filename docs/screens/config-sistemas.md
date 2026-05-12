# Tela: Configurações — Sistemas

**Rota:** `/configuracoes/sistemas`  
**Acesso:** Todos os usuários autenticados (ações de escrita apenas admin)  
**Componente:** `src/app/(protected)/configuracoes/sistemas/SistemasClient.tsx`  
**Server Actions:** `src/features/qa/actions/sistemas.ts`

## Descrição

Gerencia os sistemas que agrupam módulos e cenários de teste. Inativar um sistema cascateia para módulos, cenários e suítes.

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de tabela via `loading.tsx` |
| Vazio | `EmptyState` com ícone Server e mensagem "Nenhum sistema cadastrado ainda." |
| Com dados | Tabela com ID, nome, descrição, módulos vinculados |
| Erro | `error.tsx` com reset |

## Ações

| Ação | Acesso | Comportamento |
|------|--------|--------------|
| Criar sistema | Admin | Modal com nome (obrigatório) + descrição |
| Editar sistema | Admin | Modal com renomeação cascateada para módulos/cenários/suítes |
| Inativar sistema | Admin | Cascata: módulos → cenários → suítes |
| Inativar em massa | Admin | Todos com cascata |
| Reativar sistema | Admin | Apenas o sistema; cascata NÃO é revertida |

## Cascata de inativação

```
Sistema inativado
└── Módulos vinculados → inativados
    └── Cenários vinculados → inativados
        └── Suítes vinculadas → inativadas
```

## Validação inline

| Campo | Regra | Mensagem |
|-------|-------|---------|
| Nome | Obrigatório | "O nome é obrigatório." |

## RBAC

- `can(role, 'menu.configuracoes.sistemas')` — visibilidade
- `requireAdmin()` no servidor para todas as mutações
