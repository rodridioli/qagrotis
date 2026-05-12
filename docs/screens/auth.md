# Telas: Autenticação

## Login

**Rota:** `/login`  
**Acesso:** Público (redireciona autenticados para `/dashboard`)  
**Arquivo:** `src/app/(auth)/login/`

### Métodos de login

| Método | Descrição |
|--------|-----------|
| E-mail + Senha | Usuários criados pelo admin via `/configuracoes/usuarios/novo` |
| Google OAuth | Usuários `@agrotis.com` (auto-registro) ou usuários externos pré-cadastrados |

### Erros de OAuth Google

| Código (`?error=`) | Causa |
|--------------------|-------|
| `UnauthorizedDomain` | E-mail externo não pré-cadastrado por admin |
| `GoogleInactive` | Usuário externo pré-cadastrado mas marcado como inativo |

### Lógica `@agrotis.com`

- Se não cadastrado → auto-registro no primeiro login
- Se cadastrado e ativo → acesso normal
- Se cadastrado e inativo → reativação automática no login

**Implementação:** `src/core/auth-google.ts` — `resolveGoogleAccess()`

---

## Definir Senha

**Rota:** `/definir-senha/[token]`  
**Acesso:** Público via token único gerado pelo admin  
**Arquivo:** `src/app/(auth)/definir-senha/[token]/`

### Fluxo

1. Admin cria usuário com senha temporária em `/configuracoes/usuarios/novo`
2. E-mail com link de definição é enviado ao usuário
3. Usuário clica no link e define sua senha permanente
4. Token expira após uso ou após prazo configurado

### Estados

| Estado | Comportamento |
|--------|--------------|
| Token válido | Formulário de nova senha |
| Token inválido/expirado | Mensagem de erro com link para suporte |
