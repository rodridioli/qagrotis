<!-- gerado por: reviewer | atualizado: 2026-05-18 -->
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

---

## Aba: Performance

Exibe cards individuais de performance por perfil de acesso, com métricas ajustadas por perfil e filtro de período.

### Arquivos principais

- `src/features/equipe/actions/equipe.ts` — `getPerformanceData(filters)` — server action principal
- `src/features/equipe/components/EquipePerformanceCard.tsx` — card de performance (UI por perfil)
- `src/features/equipe/lib/equipe-performance-utils.ts` — funções puras: `isoToDateOnly`, `countUniqueByTypes`, `topProjectsByIssueCount`
- `src/app/(protected)/equipe/EquipeClient.tsx` — gerencia estado do filtro de período e perfil selecionado

### Filtros de período

`Hoje` · `Mês atual` · `Mês anterior` · `Ano`

### Cards por perfil

#### QA

| Seção | Dados |
|-------|-------|
| Linhas de detalhe | Sistemas + módulos onde o usuário tem cenários no período (`atividadePorSistema`) |
| Cenários | Count de cenários criados (`cenariosCriados`) |
| Testes | Count de execuções de suítes atribuídas ao usuário (`testesExecutados`) |
| Sucesso | Count de histórico resultado = Sucesso |
| Alertas | Count de histórico resultado = Alerta |
| Erros | Count de histórico resultado = Erro |
| Barra | % de cenários automatizados (`percentualAutomatizado`) |

#### UX

| Seção | Dados |
|-------|-------|
| Linhas de detalhe | Top 3 projetos Jira por count de issues distintas (`atividadePorProjeto`) |
| Novos Protótipos | Issues com `typeField` = New ou Redesign (deduplicadas por issueKey) |
| Pesquisa | Issues com `typeField` = Research |
| Ajustes em Protótipos | Issues com `typeField` = Improvement ou Adjustment/Return |
| Usabilidade | Issues com `typeField` = Usability |
| Barra Taxa de Retorno | % de issues que saíram de "Entregue" e voltaram para "Pending UX" |

Fonte: Jira API (worklogs do usuário no período) via `fetchJiraMetricsForUser`.

#### TW

| Seção | Dados |
|-------|-------|
| Linhas de detalhe | Top 3 projetos Jira por count de issues distintas (`atividadePorProjeto`) |
| Novos | Issues com `typeField` = New Documentation |
| Revisões | Issues com `typeField` = Documentation Review |
| Outros | Issues com `typeField` = Others |

Fonte: Jira API — mesma stack que UX.

#### MGR

| Seção | Dados |
|-------|-------|
| Feedbacks | Count global de registros em `IndividualFeedback` no período (`updatedAt`) |
| Avaliações | Count global de registros em `IndividualPerformanceEvaluation` no período |

Sem linhas de detalhe e sem barra de progresso.

### Integrações Jira (UX/TW)

- Credenciais resolvidas via `resolveJiraCredentialsForRequest(session.user.id)` — MGR fallback automático
- Busca por `accountId` do usuário via `findJiraAccountIdByEmail`
- Worklogs recuperados por `fetchWorklogsForAuthorInRange` + enriquecimento de campos via `fetchIssueFieldsForKeys` + `augmentFieldMapWithGetIssueFallback`
- Chamadas em batches de 5 usuários com `Promise.allSettled` — falhas individuais isoladas via `EMPTY_JIRA_METRICS`
- Taxa de retorno UX: `countStatusTransitionsToValue(keys, "Pending UX")` — chamado apenas quando `validKeys.length > 0`

### Banco de dados (MGR)

- `$queryRawUnsafe` com `tableName` como union type TypeScript (injection-safe)
- Parâmetros de data passados como `Date[]` parametrizados (`$1`, `$2`)
- `ensureIndividualFeedbackTable()` e `ensureIndividualPerformanceEvaluationTable()` chamados antes do count

### RBAC

- `can(role, 'equipe.performance')` — acesso à aba
- `can(role, 'equipe.performance.filterByProfile')` — filtro de perfil (apenas Administrador:MGR)
- Dados Jira requerem credenciais cadastradas no sistema; sem credenciais → métricas zeradas sem erro

### Testes

- `__tests__/equipe-performance-utils.test.ts` — 14 casos Vitest cobrindo `isoToDateOnly`, `countUniqueByTypes` (dedup, case-insensitive, multi-type) e `topProjectsByIssueCount` (top N, fallback, dedup)

---

## RBAC Geral da Tela

- `can(role, 'menu.equipe')` — visibilidade do menu
- Criar/remover/editar chapters: apenas admin
- Avaliar chapters: todos os usuários autenticados
