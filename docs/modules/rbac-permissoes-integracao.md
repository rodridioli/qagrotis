<!-- gerado por: reviewer | atualizado: 2026-05-30 -->
# RBAC — Permissões e Bloqueio por Integração

## Objetivo

Controlar acesso granular por seção do sistema de acordo com o perfil do usuário, e bloquear funcionalidades que dependem de integrações externas (Jira, Clockwork) quando estas não estiverem configuradas.

---

## Perfis com Acesso e Regras de Negócio

| Perfil | Descrição |
|---|---|
| `Administrador:MGR` | Acesso irrestrito. Único que pode configurar Clockwork e gerenciar equipes. |
| `Administrador:QA/UX/TW` | Acesso aos próprios dados + membros da equipe, conforme matriz abaixo. |
| `Padrão:*` | Apenas dados próprios. |

### Matriz de Permissões por Seção (Individual)

| Seção | Padrão | Admin QA/UX/TW | Admin MGR |
|---|---|---|---|
| Ficha | Própria | Própria | Todas |
| Progressão | Própria | Própria | Todas |
| **Domínio** | Próprio | **Próprio + Equipe (read-only)** | Todos |
| Férias | Próprias | Próprias | Todas |
| Ausências | Próprias | Próprias | Todas |
| Avaliações | Próprias | Próprias | Todas |
| Feedbacks | Próprios | Próprios | Todos |
| Conquistas | Próprias | Próprias | Todas |
| PDI | Próprio | Próprio | Todos |
| Registros/Lançamentos | Próprios | Próprios + Equipe | Todos |

**Regra-chave:** `TEAM_VIEWABLE_SECTIONS = ["dominio"]` em `individual/[secao]/page.tsx`. Todas as outras seções usam apenas `canViewOthers` (MGR).

---

## Bloqueio por Integração Não Configurada

Aplica-se exclusivamente a **Administrador:MGR**.

### Jira — Funcionalidades bloqueadas

- `/kanban` — verificação server-side antes de qualquer fetch
- `/dashboard?perfil=QA|UX|TW|MGR` — verificação antes dos fetches de painéis
- `/equipe?tab=lancamentos` — `EquipeClient` bloqueia antes de renderizar `EquipeLancamentosSection`

### Clockwork — Funcionalidades bloqueadas

- `/equipe?tab=clockwork` — `EquipeClient` bloqueia antes de renderizar `EquipeClockworkSection`

### Componente de Bloqueio

`IntegrationNotConfiguredCard` (`src/components/shared/IntegrationNotConfiguredCard.tsx`):
- Props: `type: "jira" | "clockwork"`
- Exibe ícone de plug desconectado (laranja), título, descrição e botão "Ir para Configurações"
- `JiraNotConfiguredCard` é um wrapper backwards-compat que sempre passa `type="jira"`

### Funções de Verificação (server-side)

`src/features/integracoes/lib/integration-status.ts`:
- `getJiraConfiguredStatus(userId)` — lê DB diretamente, sem HTTP
- `getClockworkConfiguredStatus()` — lê DB ou variável de ambiente `CLOCKWORK_API_TOKEN`

---

## Banco de Dados / Integrações

- **Jira credentials**: tabela `UserJiraCredentials` — per-user, campo `apiToken` criptografado
- **Clockwork credentials**: tabela `ClockworkIntegration` (singleton `id="default"`) — campo `apiToken` criptografado
- **Team membership**: tabela `TeamMembership` — `leaderId → memberId`

---

## Fluxos e Validações

### Check de Integração (Server Component)
1. `auth()` → verifica sessão
2. `buildRole()` + `can()` → verifica permissão RBAC
3. `getJiraConfiguredStatus(userId)` ou `getClockworkConfiguredStatus()` → se `false`, retorna `<IntegrationNotConfiguredCard>` imediatamente sem executar fetches downstream

### IDOR — API `/api/jira/lancamentos`
- Se `!canViewOthers` (não-MGR) e `requestedUserId !== session.user.id`:
  - Valida que `requestedUserId` está em `getTeamMemberIds(session.user.id)`
  - Retorna 403 caso contrário

### IDOR — API `/api/clockwork/worklogs`
- Se `!can(role, "individual.viewOthers")` (não-MGR):
  - Bloqueia acesso a qualquer `userId ≠ session.user.id`
  - Retorna 403

---

## Mensagens Removidas

A mensagem `"Utilizador Jira não encontrado por e-mail"` foi **removida completamente** de `IndividualLancamentosSection`. O cenário `noJiraUser` agora é tratado implicitamente — se o usuário não tem Jira configurado, a tela é bloqueada antes de chegar a esse estado.
