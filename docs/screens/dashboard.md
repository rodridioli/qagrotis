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
| `MetricCard` | Cards de métricas com sparkline (Tempo médio → Atividade, Valor médio → Atividade, Total de Jiras, Total de Críticos) |
| `TypeCard` | Cards de tipo por grupo: azul (Protótipos, Pesquisas, Usabilidade, Outros), violeta (Novos, Melhorias, Ajustes), âmbar (Retornos) |
| `TagBarChart` | Gráfico de barras horizontal (recharts) agrupando issues por tag Jira |
| `YearTable` | Tabela anual por trimestre/mês com grupos de colunas coloridos |
| `SparklineChart` | Minigráfico de área mensal dentro dos MetricCards |

### Cards de Tag (TagBarChart)

| Card | Fonte de dados | Filtro |
|---|---|---|
| **Distribuição por Produto** | Todas as issues do período agrupadas por `tag` | Nenhum — todas as issues |
| **Atividades em Aprovação** | Issues agrupadas por `tag` | `status === "approval"` (case-insensitive) |

Issues sem tag preenchida aparecem no bucket `"Sem tag"`.

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
      → syncMonthsForUser() → JiraWorklogCache (inclui campo `tag`)
    → useMemo: agrega monthStats + distribByTag + approvalByTag
    → render: MetricCards + TypeCards + TagBarChart × 2 + YearTable
```
