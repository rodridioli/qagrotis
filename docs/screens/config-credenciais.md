# Tela: Configurações — Credenciais

**Rota:** `/configuracoes/credenciais`  
**Acesso:** Todos os usuários autenticados (ações de escrita apenas admin)  
**Server Actions:** `src/features/qa/actions/credenciais.ts`

## Descrição

Gerencia credenciais de acesso (URL, usuário, senha) que podem ser vinculadas a cenários de teste. Senhas são criptografadas com AES-256-GCM via `encryptField()`.

## Segurança

- Campo `senha` **nunca** é retornado em selects de listagem
- `getCredenciais()` não inclui `senha` no select do Prisma
- Senha é retornada apenas em `getCredencial(id)` para edição, decriptografada sob `requireAdmin()`
- Ao vincular credencial a cenário, a URL e usuário são copiados para o cenário; a senha em si permanece na credencial

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de tabela via `loading.tsx` |
| Vazio | `EmptyState` com mensagem "Nenhum registro encontrado." |
| Com dados | Tabela com nome, URL, usuário (senha mascarada) |
| Erro | `error.tsx` com reset |

## Ações

| Ação | Acesso | Descrição |
|------|--------|-----------|
| Criar credencial | Admin | Nome, URL, usuário e senha (obrigatórios) |
| Editar credencial | Admin | Pode manter senha existente ou alterar |
| Inativar credencial | Admin | Soft-delete |
| Reativar credencial | Admin | Visível com filtro "Exibir inativos" |

## RBAC

- `can(role, 'menu.configuracoes.credenciais')` — visibilidade
- `requireAdmin()` em todas as mutações
