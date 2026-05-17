<!-- gerado por: reviewer | atualizado: 2026-05-17 -->
# Tela: Equipe

**Rota:** `/equipe`  
**Acesso:** Todos os usuários autenticados  
**Arquivo:** `src/app/(protected)/equipe/`  
**Server Actions:** `src/features/equipe/actions/equipe-chapters.ts`, `src/features/equipe/actions/equipe.ts`

## Descrição

Página central da equipe com múltiplas abas: Chapters, Lançamentos, Performance, Horários, Férias, Ausências, Metas e Aniversários.

---

## Aba: Chapters

Gerencia encontros semanais de compartilhamento de conhecimento. Inclui calendário de quintas-feiras (America/Sao_Paulo), avaliação por estrelas e ranking de autores.

### Funcionalidades

- **Listagem de chapters** — data, tema, autores, hiperlink, média de avaliação
- **Criar chapter** — data (quintas-feiras do Brazil TZ), tema, autores, hiperlink opcional
- **Editar chapter** — admin apenas
- **Remover chapter** — hard-delete (admin)
- **Avaliar chapter** — 0–5 estrelas (upsert por usuário)
- **Ranking de autores** — paginado, ordenado por número de chapters

### Regras de negócio

- Datas válidas: qualquer data civil (edição) ou quintas-feiras do calendário Brazil (criação)
- Hiperlink: deve ser URL válida se preenchido
- Autores: pelo menos 1 autor ativo obrigatório
- Avaliação: upsert — reavaliação atualiza nota existente, não duplica

### Utilitários

- `src/features/equipe/lib/equipe-chapter-dates.ts` — validação de datas no timezone America/Sao_Paulo

---

## Aba: Lançamentos

Exibe worklogs Jira (+ Clockwork) de membros da equipe agrupados por período. Cada perfil de acesso exibe cards de métricas específicos.

### Arquivos principais

- `src/features/equipe/components/EquipeLancamentosSection.tsx` — seletor de membros, filtros de perfil e período
- `src/features/individual/components/IndividualLancamentosSection.tsx` — DashboardPanel + tabela de worklogs
- `src/app/api/jira/lancamentos/route.ts` — GET endpoint; busca, mescla Jira+Clockwork, enriquece campos e calcula contadores
- `src/features/equipe/actions/equipe.ts` — `getEquipeMembrosParaLancamentos()` filtra membros ativos por perfil

### Perfis e Cards

| Perfil | Card 1 | Fonte | Card 2 | Fonte |
|--------|--------|-------|--------|-------|
| QA | Retorno de Testes | `brokenTestSubtasksTotalInScope` / `reporterBrokenTestIssueCount` | Testes Realizados | `qtdCenariosQA` (soma por issue) |
| UX | Pesquisas | `typeField === "research"` | Usabilidade | `typeField === "usability"` |
| TW | Documentos Revisados | `typeField === "documentation review"` | Novos Documentos | `typeField === "new documentation"` |
| MGR | Operacional | "Em breve" (estático) | Gestão | "Em breve" (estático) |

Todos os contadores usam apenas issues dentro do intervalo `from`/`to` do período selecionado.

Todos os perfis exibem também: **Total de Jiras** e **Jiras Críticos** (invariantes).

### Filtros de período disponíveis

`today` · `anteriormente` · `week` · `month` · `lastMonth`

O preset `anteriormente` usa refinamento em duas fases: busca 14 dias e refina para o dia mais recente com dados.

### Visibilidade por perfil do viewer

- Usuários com perfil **QA, UX ou TW** (Padrão ou Administrador) **não veem** membros MGR na lista de avatares nem no dropdown de perfil.
- Apenas **Administrador:MGR** vê outros usuários MGR.

### RBAC

- `can(role, "equipe.lancamentos")` — acesso à aba
- `can(role, "individual.viewOthers")` — Administrador:MGR pode ver qualquer usuário ativo
- `manageableProfiles(role)` — Admins não-MGR só veem usuários do seu perfil gerenciável
- `can(role, "equipe.performance.filterByProfile")` — apenas Administrador:MGR pode usar o filtro de perfil

---

## RBAC Geral da Tela

- `can(role, 'menu.equipe')` — visibilidade do menu
- Criar/remover/editar chapters: apenas admin
- Avaliar chapters: todos os usuários autenticados
