# Tela: Configurações — Usuários

**Rota:** `/configuracoes/usuarios`  
**Acesso:** Todos os usuários autenticados  
**Componente:** `src/app/(protected)/configuracoes/usuarios/UsuariosClient.tsx`  
**Formulário:** `src/app/(protected)/configuracoes/usuarios/UsuarioFormTabs.tsx`  
**Server Actions:** `src/features/usuarios/actions/usuarios.ts`

## Descrição

Gerencia todos os usuários do sistema. Administradores podem criar, editar, inativar e reativar usuários.

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de tabela via `loading.tsx` |
| Vazio | `EmptyState` com ícone Users e mensagem contextual |
| Com dados | Tabela com avatar, nome, tipo, perfil, e-mail |
| Indisponível | Mensagem de fallback para falha de banco |
| Erro | `error.tsx` com reset |

## Tipos de Usuário × Perfil de Acesso

| Tipo | Perfil | Role |
|------|--------|------|
| Padrão | QA | padrao-qa |
| Padrão | UX | padrao-ux |
| Padrão | TW | padrao-tw |
| Administrador | QA | admin-qa |
| Administrador | UX | admin-ux |
| Administrador | TW | admin-tw |
| Administrador | MGR | admin-mgr |

## Formulário de Usuário (UsuarioFormTabs)

### Abas

1. **Cadastro** — Nome, e-mail, tipo, perfil, datas, horários, senha
2. **Endereço** — CEP (busca automática via ViaCEP), endereço, contato
3. **Formação** — Educação, cursos, idiomas, certificações

### Validações inline

| Campo | Regra | Mensagem |
|-------|-------|---------|
| Nome | Obrigatório | "Nome é obrigatório." |
| E-mail | Obrigatório | "E-mail é obrigatório." |
| Senha | Obrigatória na criação | "Senha é obrigatória." |
| Confirmar senha | Deve coincidir | "As senhas não coincidem." |

## RBAC

- `can(role, 'menu.configuracoes.usuarios')` — visibilidade
- `isAdmin` para criar/inativar/reativar
- Usuário Padrão pode editar apenas próprio perfil
- Admin MGR pode editar todos os usuários
- Último admin não pode ser inativado

## Rotas relacionadas

- `/configuracoes/usuarios/novo` — criar usuário
- `/configuracoes/usuarios/[id]` — perfil do usuário
- `/configuracoes/usuarios/[id]/editar` — editar usuário
