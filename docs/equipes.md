# Equipes

Módulo que permite ao Administrador:MGR configurar vínculos líder-membro entre usuários Administradores (QA/UX/TW) e usuários Padrão do mesmo perfil.

## Acesso

| Role | Acesso |
|---|---|
| Administrador:MGR | Configuração completa (leitura + escrita) |
| Administrador:QA/UX/TW | Visualização da própria equipe em Registros e Individual |
| Padrão:* | Nenhum |

## Rota

`/configuracoes/equipes` — listagem de líderes e gerenciamento de vínculos.

## Regras de Negócio

- Um membro (Padrão) pertence a no máximo **uma** equipe por vez (`@@unique([memberId])` no DB).
- Líder e membro devem ter o **mesmo** `accessProfile` (QA→QA, UX→UX, TW→TW).
- Apenas usuários `type = "Padrão"` podem ser membros; apenas `type = "Administrador"` com perfil QA/UX/TW podem ser líderes.
- Ao tentar vincular membro já em outra equipe: erro informativo com nome do líder atual.

## Impacto em Outras Funcionalidades

### Registros (Lancamentos)
`getEquipeMembrosParaLancamentos` filtra por equipe quando o caller tem `individual.viewTeam`. Líderes sem membros veem apenas a si mesmos.

### Individual (Feedbacks e Avaliações)
`requireFeedbackAccess` / `requirePerformanceAccess` aceitam `individual.viewOthers` (MGR, sem restrição) **ou** `individual.viewTeam` (QA/UX/TW admin, restrito à equipe). Writes (create/update/delete) permanecem exclusivos do MGR.

## Banco de Dados

```
model TeamMembership {
  id        String   @id @default(cuid())
  leaderId  String                          -- FK → CreatedUser (Administrador QA/UX/TW)
  memberId  String   @unique               -- FK → CreatedUser (Padrão QA/UX/TW)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([leaderId])
  @@map("team_memberships")
}
```

## RBAC

| Capability | Roles |
|---|---|
| `config.equipes` | Administrador:MGR |
| `individual.viewTeam` | Administrador:QA, Administrador:UX, Administrador:TW |

## Server Actions

Arquivo: `src/features/equipe/actions/equipes.ts`

| Função | Descrição |
|---|---|
| `listLideres()` | Lista Admins QA/UX/TW com contagem de membros |
| `getMembrosDoLider(leaderId)` | Membros vinculados ao líder |
| `listMembrosDisponiveis(leaderId)` | Usuários Padrão sem equipe, mesmo perfil |
| `addMembro(leaderId, memberId)` | Cria vínculo com validações de segurança |
| `removeMembro(memberId)` | Remove vínculo |
| `getTeamMemberIds(leaderId)` | IDs dos membros (uso interno, sem auth guard) |
