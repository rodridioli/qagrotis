# Tela: Dashboard

**Rota:** `/dashboard`  
**Acesso:** Todos os usuários autenticados  
**Arquivo:** `src/app/(protected)/dashboard/`

## Descrição

Página inicial após o login. Exibe visão geral do estado do QA: estatísticas de cenários, suítes e progresso da equipe.

Ao acessar com `?perfil=UX`, exibe o **Dashboard UX** exclusivo para Administrador:MGR.

## Conteúdo esperado

- Contagem de cenários ativos/inativos
- Contagem de suítes por situação
- Atividade recente

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Spinner via `loading.tsx` existente |
| Erro | `error.tsx` com reset |

## RBAC

- Acessível a todos os usuários autenticados
- Conteúdo pode variar por `accessProfile`

---

## Dashboard UX — `/dashboard?perfil=UX`

**Acesso:** Exclusivo para `Administrador:MGR`  
**Arquivo:** `src/app/(protected)/dashboard/UxDashboardClient.tsx`

### Componentes

| Componente | Descrição |
|---|---|
| `UxAvatarStrip` | Fotos clicáveis dos membros da equipe; filtro multi-seleção que afeta todos os cards |
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

---

## Dashboard TW — `/dashboard?perfil=TW`

**Acesso:** Exclusivo para `Administrador:MGR`  
**Arquivo:** `src/app/(protected)/dashboard/TwDashboardClient.tsx`

### Descrição

Dashboard para a equipe de Technical Writers. Espelha a estrutura do Dashboard UX com TypeCards e tabela anual adaptados para os tipos de atividade TW.

### Componentes

| Componente | Descrição |
|---|---|
| `AvatarStrip` | Fotos clicáveis dos membros TW; filtro multi-seleção |
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
  → getEquipeMembrosParaLancamentos("TW")  [filtra por accessProfile = "TW"]
  → getUxWorklogsForYear()  [Server Action genérico — reutilizado do UX]
  → getUxApprovalIssuesByTag()  [JQL ao vivo]
  → TwDashboardClient (client)
    → useMemo: agrega TwMonthStats (pass 1: horas/investimento) +
               TwYearTotals via aggregateTwYearTotals() (pass 2: issue counts)
    → render: AvatarStrip + MetricCards (4) + TypeCards (4)
              + TagBarChart ("Jiras por Produto")
              + TagPieChart ("Atividades em Aprovação")
              + TwYearTable
```

### RBAC

- `page.tsx` redireciona para `/dashboard` se `role !== "Administrador:MGR"`
- `getUxWorklogsForYear` e `getEquipeMembrosParaLancamentos` verificam auth internamente
