# Tela: Configurações — Clientes

**Rota:** `/configuracoes/clientes`  
**Acesso:** Todos os usuários autenticados (ações de escrita apenas admin)  
**Componente:** `src/app/(protected)/configuracoes/clientes/ClientesClient.tsx`  
**Server Actions:** `src/features/qa/actions/clientes.ts`

## Descrição

Gerencia os clientes que podem ser associados a cenários e suítes de teste.

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de tabela via `loading.tsx` |
| Vazio | `EmptyState` com ícone Building2 e mensagem "Nenhum cliente cadastrado ainda." |
| Com dados | Tabela com ID, Nome Fantasia, CPF/CNPJ, Razão Social |
| Erro | `error.tsx` com reset |

## Ações

| Ação | Acesso | Validações |
|------|--------|-----------|
| Adicionar cliente | Admin | Nome Fantasia obrigatório; CPF/CNPJ se preenchido deve ser válido |
| Editar cliente | Admin | Mesmas validações do cadastro |
| Inativar cliente | Admin | Soft-delete; limpa campo cliente em cenários/suítes vinculados |
| Inativar em massa | Admin | Bulk via checkboxes |
| Reativar cliente | Admin | Visível ao filtrar "Exibir inativos" |

## Validação de CPF/CNPJ

- Utiliza `validateCpfCnpj()` de `src/core/utils.ts`
- CPF: 11 dígitos, dígito verificador validado
- CNPJ: 14 dígitos, dígito verificador validado
- Rejeita sequências de dígitos iguais (ex: 111.111.111-11)
- Campo opcional — se vazio, não é validado

## Validação inline

Erros são exibidos diretamente abaixo do campo com `text-destructive`:
- Nome Fantasia: "O Nome Fantasia é obrigatório."
- CPF/CNPJ: "CPF ou CNPJ inválido."

## RBAC

- `can(role, 'menu.configuracoes.clientes')` — visibilidade
- Ações de escrita requerem `requireAdmin()` no servidor
