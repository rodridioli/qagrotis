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

### Campo `assigneeAccountId` no Jira

Jira account ID do **assignee** atual do jira (quem o ticket está atribuído).  
- Buscado junto com os demais campos em `fetchIssueFieldsForKeys` (campo `assignee.accountId`)
- Armazenado na coluna `assigneeAccountId` de `JiraWorklogCache`
- Usado exclusivamente no filtro do card "Atividades em Aprovação"
- Registros anteriores à migration têm valor `null` — sync forçado os atualiza

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
            (campos: tag, status, typeField, priority, assigneeAccountId, ...)
    → useMemo: agrega monthStats + distribByTag + approvalByTag
        distribByTag  → filtra por activeMembers (worklog author)
        approvalByTag → itera todos os members; filtra por assigneeAccountId quando seleção ativa
    → render: UxAvatarStrip + MetricCards + TypeCards
              + TagBarChart ("Jiras por Produto")
              + TagPieChart ("Atividades em Aprovação")
              + YearTable
```
