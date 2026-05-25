# Tela: Dashboard

**Rota:** `/dashboard`  
**Acesso:** Todos os usuários autenticados  
**Arquivo:** `src/app/(protected)/dashboard/`

## Descrição

Página inicial após o login. Exibe KPIs de lançamentos Jira por período (trimestre / semestre / ano).  
Suporta três perfis: `?perfil=QA` (padrão), `?perfil=UX`, `?perfil=TW`.

## KPIs do Dashboard QA

| KPI | Fonte de Dados | Observações |
|---|---|---|
| Total de Jiras | `JiraWorklogCache` (worklogs únicos por issueKey) | Deduplicado por período via `Set<string>` |
| Jiras Críticos | `JiraWorklogCache.priority` (worklogs únicos) | Dedup por issueKey no período |
| Cenários Testados | `JiraWorklogCache.qtdCenariosQA` (max por issueKey) | Dedup via `Map<issueKey, number>` |
| **Jiras de Retorno (Broken)** | **`JiraWorklogSyncMarker.jirasBroken`** | **JQL por reporter independente de worklogs** |
| **Cenários com Erro** | **Tipo A + Tipo B** | **Ver seção abaixo** |
| Horas totais | `JiraWorklogCache.timeSpentSeconds` (soma) | Por membro, por mês |
| Investimento | `progressaoMap.valorHora × horas` | Calculado no front, sensível (ocultável) |

## ⚠️ Arquitetura Crítica — Broken Test e Cenários com Erro

### Por que não usar `issueType === "Broken Test"` dos worklogs?

O fluxo real do QA é:
1. Lança horas na **issue-pai** (ex: ARM-8754, tipo "Tarefa" ou "[TESTE]")
2. Cria uma **subtarefa Broken Test** como **reporter**, SEM lançar horas nela

Logo, os worklogs NÃO contêm entradas com `issueType = "Broken Test"` para a maioria dos casos. Usar esse campo como fonte de `jirasBroken` resulta em **subestimação grave** (ex: 1 vs 9).

### Fonte correta — `JiraWorklogSyncMarker`

Durante o sync de cada mês, o back-end executa:
- `countReporterIssuesByTypes` → JQL: `reporter = accountId AND issuetype = "Broken Test" AND status != "Cancelado" AND created >= fromIso AND created < upperExclusive`
- `fetchBrokenTestFieldSumByReporter` → soma `qtdCenariosQA` das BT issues acima

Os resultados são gravados em `JiraWorklogSyncMarker.jirasBroken` e `JiraWorklogSyncMarker.cenariosErroSum`.  
O Dashboard lê esses campos via `getUxWorklogsForYear` → `btStatsByMonth`.

### Cenários com Erro — Tipo A + Tipo B

| Tipo | Fonte | Quando aplicar |
|---|---|---|
| A | `JiraWorklogCache.qtdCenariosErro` (campo Jira) | Issues onde o QA preencheu o campo "Qtd. Cenários com Erro" |
| B | `JiraWorklogSyncMarker.cenariosErroSum` (reporter JQL) | Soma de `qtdCenariosQA` das BT issues por reporter (não têm `qtdCenariosErro`) |

**Total = Tipo A + Tipo B.** Não há dupla contagem porque:
- Tipo A vem de issues com worklogs (deduplicado por issueKey)
- Tipo B vem de BT issues sem worklogs, bucketed pela data de criação

### Invariante de paridade

`JiraWorklogSyncMarker.jirasBroken` e `cenariosErroSum` são calculados com a **mesma lógica** de `/api/jira/lancamentos`. A tela de Lançamentos e o Dashboard **devem sempre concordar** nesses dois KPIs.

Se divergirem: forçar sync (botão RefreshCw) — o TTL de 15 min da atualização de metadados inclui refresh dos campos BT no `JiraWorklogSyncMarker`.

## Cache e Sync

| Modelo | Propósito |
|---|---|
| `JiraWorklogCache` | Worklogs individuais (issueKey + startedAt + campos) |
| `JiraWorklogSyncMarker` | Controle de sync por (userId, year, month) + BT reporter stats |
| `JiraAccountIdCache` | AccountId Jira persistente (sobrevive ao force-sync) |

TTL de metadados: **15 minutos** por (userId, year) em memória de processo.  
Force sync: apaga `JiraWorklogCache` + `JiraWorklogSyncMarker` e re-sincroniza tudo.

## RBAC

- Acessível a todos os usuários autenticados
- Dashboard de equipe: apenas `Administrador:MGR`
- Filtro por membro: apenas `Administrador:MGR` (via `can(role, "individual.viewOthers")`)

---

## Dashboard UX — `/dashboard?perfil=UX`

**Acesso:** Exclusivo para `Administrador:MGR`  
**Arquivo:** `src/app/(protected)/dashboard/UxDashboardClient.tsx`

### Componentes

| Componente | Descrição |
|---|---|
| `UxAvatarStrip` | Fotos clicáveis dos membros ativos e inativos; inativos aparecem por último em grayscale permanente com badge `Info`; filtro multi-seleção que afeta todos os cards |
| `MetricCard` | Cards de métricas com sparkline (Tempo médio → Atividade, Valor médio → Atividade, Total de Jiras, Total de Críticos) |
| `TypeCard` | Cards de tipo por grupo: azul (Protótipos, Pesquisas, Usabilidade, Outros), violeta (Novos, Melhorias, Ajustes), âmbar (Retornos) |
| `TagBarChart` | Gráfico de barras (recharts) — card "Jiras por Produto" |
| `TagPieChart` | Gráfico de donut (recharts) — card "Atividades em Aprovação" com filtro por assignee |
| `YearTable` | Tabela anual por trimestre/mês com grupos de colunas coloridos |
| `SparklineChart` | Minigráfico de área mensal dentro dos MetricCards |

### Cards de Tag

| Card | Componente | Fonte de dados | Filtro por seleção de usuário |
|---|---|---|---|
| **Jiras por Produto** | `TagBarChart` | Worklogs dos membros ativos, agrupados por `tag` | Por worklog author (membro selecionado) |
| **Atividades em Aprovação** | `TagPieChart` | **Todos** os worklogs (todos os membros), filtrados por `status === "approval"` | Por `assigneeAccountId` (jira atribuído ao membro selecionado no Jira) |

Issues sem tag preenchida aparecem no bucket `"Sem tag"`.

**Comportamento do filtro de Aprovação:**  
Ao clicar na foto de um membro no avatar strip, o card "Atividades em Aprovação" exibe apenas os jiras cujo **assignee no Jira** é esse membro — independente de quem logou horas no jira. Jiras com `assigneeAccountId = null` (cacheados antes da migration) são excluídos quando há seleção ativa. Um **sync forçado** (botão 🔄) preenche o campo para todos os jiras existentes.

### Campo `tag` no Jira

O campo **Tag** é um custom field no Jira (ex: `"UBA"`), diferente do campo padrão `labels`.  
- Descoberto dinamicamente via `resolveTagFieldId` em `jira-worklogs-fetch.ts`
- Override via env var: `JIRA_TAG_FIELD_ID=customfield_XXXXX`
- Armazenado na coluna `tag` de `JiraWorklogCache`
- Populado apenas após sync (worklogs cacheados antes da migration permanecem `null`)

### Tabela Anual (YearTable)

**Ordem das colunas:** Trimestre → Investimento → Horas → Jiras → Protótipos → Pesquisas → Usabilidade → Outros → Novos → Melhorias → Ajustes → Retornos

**Grupos visuais:**
- `bg-blue-50/60` — Protótipos, Pesquisas, Usabilidade, Outros (grupo "Escopo")
- `bg-violet-50/60` — Novos, Melhorias, Ajustes (grupo "Tipo de Protótipo")

### Data flow

```
page.tsx (Administrador:MGR detectado via perfil=UX)
  → getEquipeMembrosParaLancamentosComInativos("UX")
      [ativos (α) + inativos (α), isInactive: boolean]
  → getApprovalIssuesByTag("UX")  [JQL ao vivo — project in ("UX")]
  → getUxMemberJiraIds(userIds)   [resolve accountId Jira por e-mail, inclui inativos]
  → UxDashboardClient (client)
    → getUxWorklogsForYear() [Server Action — auth + RBAC]
      → syncMonthsForUser()
        → fetchIssueFieldsForKeys() → JiraWorklogCache
            (campos: tag, status, typeField, priority, retornos, retornosByAssignee, ...)
    → useMemo: agrega monthStats + distribByTag + approvalByTag
        distribByTag  → filtra por activeMembers (worklog author)
        approvalByTag → liveApprovalIssues (JQL ao vivo), filtrado por assigneeAccountId quando seleção ativa
    → render: UxAvatarStrip + MetricCards + TypeCards
              + TagBarChart ("Jiras por Produto")
              + TagPieChart ("Atividades em Aprovação")
              + YearTable
```

### Membros inativos (UX e TW)

- `getEquipeMembrosParaLancamentosComInativos` retorna todos os membros do perfil, incluindo os registrados em `InactiveUser`
- Inativos têm `isInactive: true` e aparecem **por último** no strip (após todos os ativos, ambos em ordem α)
- Avatar inativo: sempre `grayscale` via prop `inactive` do `UserAvatar` + badge `Info` cinza (`bg-neutral-grey-400`)
- Badge `AlertTriangle` (amarelo, sem dados) tem precedência sobre o badge `Info` quando o membro é inativo **e** sem sync
- Dados dos inativos são contabilizados nos totais enquanto nenhum filtro está ativo
- O filtro funciona normalmente para inativos: clicar no avatar exibe apenas os dados daquele membro

---

## Dashboard TW — `/dashboard?perfil=TW`

**Acesso:** Exclusivo para `Administrador:MGR`  
**Arquivo:** `src/app/(protected)/dashboard/TwDashboardClient.tsx`

### Descrição

Dashboard para a equipe de Technical Writers. Espelha a estrutura do Dashboard UX com TypeCards e tabela anual adaptados para os tipos de atividade TW.

### Componentes

| Componente | Descrição |
|---|---|
| `AvatarStrip` | Fotos clicáveis dos membros TW (ativos + inativos); inativos por último em grayscale + badge `Info`; filtro multi-seleção |
| `MetricCard` | Cards com sparkline (Tempo médio → Atividade, Valor médio → Atividade, Total de Jiras, Total de Críticos) |
| `TypeCard` | 4 cards: Novas Documentações (azul), Revisões (azul), Outras Atividades (azul), Retornos (warning) |
| `TagBarChart` | Gráfico de barras — "Jiras por Produto" |
| `TagPieChart` | Gráfico de donut — "Atividades em Aprovação" |
| `TwYearTable` | Tabela anual por trimestre/mês com 8 colunas |

### Mapeamento de typeField TW

| Valor (case-insensitive) | Bucket |
|---|---|
| `"new documentation"` | Novas Documentações |
| `"documentation review"` | Revisões |
| `"others"` / `"other"` | Outras Atividades |
| Qualquer outro / `null` / vazio | Outras Atividades (bucket residual) |

### Tabela Anual (TwYearTable)

**Ordem das colunas:** Trimestre → Investimento → Horas → Jiras → Novas Docs → Revisões → Outras Atividades → Retornos

**Grupos visuais:**
- `bg-[#EDF5F3]/80` — Novas Docs, Revisões, Outras Atividades

### Data flow

```
page.tsx (Administrador:MGR detectado via perfil=TW)
  → getEquipeMembrosParaLancamentosComInativos("TW")
      [ativos (α) + inativos (α), isInactive: boolean]
  → getApprovalIssuesByTag("TW")  [JQL ao vivo — project in ("Documentação Técnica")]
  → getUxMemberJiraIds(userIds)   [resolve accountId Jira por e-mail, inclui inativos]
  → TwDashboardClient (client)
    → getUxWorklogsForYear()  [Server Action genérico — reutilizado do UX]
    → getApprovalIssuesByTag("TW")  [re-fetch ao mudar ano]
    → useMemo: agrega TwMonthStats (pass 1: horas/investimento) +
               TwYearTotals via aggregateTwYearTotals() (pass 2: issue counts)
    → render: AvatarStrip + MetricCards (4) + TypeCards (4)
              + TagBarChart ("Jiras por Produto")
              + TagPieChart ("Atividades em Aprovação")
              + TwYearTable
```

### RBAC

- `page.tsx` redireciona para `/dashboard` se `role !== "Administrador:MGR"`
- `getUxWorklogsForYear`, `getApprovalIssuesByTag` e `getEquipeMembrosParaLancamentosComInativos` verificam auth internamente
