"use client"

import * as React from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Bug,
  CheckCircle2,
  FileCheck,
  FilePlus,
  Flame,
  Hash,
  LayoutDashboard,
  Layers,
  LoaderCircle,
  PlugZap,
  Search,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { JiraPriorityBadge } from "@/components/shared/StatusBadge"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/core/utils"
import {
  getLancamentosPresetLabel,
  getLancamentosPresetRange,
  LANCAMENTOS_PRESET_OPTIONS,
  type LancamentosPeriodPreset,
} from "@/features/individual/lib/individual-lancamentos-date-presets"
import { computeJiraKpis } from "@/features/qa/lib/jira-stats-kpis"

export interface IndividualLancamentosSectionProps {
  evaluatedUserId: string
  /** Perfil de acesso do membro avaliado — controla quais cards são exibidos no DashboardPanel. */
  evaluatedUserAccessProfile?: "QA" | "UX" | "TW" | "MGR" | null
  /** Controlado externamente (ex.: IndividualSecaoDevelopmentPanel). Quando fornecido, omite o Select interno. */
  preset?: LancamentosPeriodPreset
  onPresetChange?: (p: LancamentosPeriodPreset) => void
}

type LancamentoRow = {
  id: string
  issueKey: string
  projectKey: string
  projectName?: string | null
  summary: string | null
  issueType?: string | null
  priority?: string | null
  labels?: string[]
  qtdCenariosQA?: number | null
  qtdCenariosErro?: number | null
  tag?: string | null
  started: string
  timeSpentSeconds: number
  hours: number
  isLongSession: boolean
  comment: string | null
  dataSource?: "jira" | "clockwork"
}

type ApiOk = {
  source: "jira"
  entries: LancamentoRow[]
  totalSeconds: number
  longSessionCount: number
  truncatedIssues: boolean
  truncatedWorklogs: boolean
  noJiraUser: boolean
  jiraBrowseBase?: string
  message?: string
  jiraAuthorDisplayName?: string | null
  includesClockwork?: boolean
  clockworkMergedCount?: number
  /** Alias legado: mesmo que `brokenTestsCreatedByUser`. */
  brokenTestsOpenedCount?: number
  brokenTestSubtasksTotalInScope?: number
  brokenTestsCreatedByUser?: number
  reporterBrokenTestIssueCount?: number
  researchCount?: number
  usabilityCount?: number
  docReviewCount?: number
  newDocCount?: number
  pendingUxReturnCount?: number
  qtdCenariosErroTotal?: number
  brokenTestIssueTypeNames?: string[]
}

function formatDurationHMin(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}min`
}

// ── Grouping ─────────────────────────────────────────────────────────────────

/** Agrupa entradas por issueKey, somando tempo e juntando comentários únicos. */
function groupByIssueKey(entries: LancamentoRow[]): LancamentoRow[] {
  const map = new Map<string, LancamentoRow[]>()
  for (const e of entries) {
    const key = e.issueKey.toUpperCase()
    const group = map.get(key)
    if (group) {
      group.push(e)
    } else {
      map.set(key, [e])
    }
  }

  const grouped: LancamentoRow[] = []
  for (const group of map.values()) {
    // Use the most-recent worklog as source of truth for metadata
    const sorted = [...group].sort((a, b) => b.started.localeCompare(a.started))
    const latest = sorted[0]!
    const totalSeconds = group.reduce((acc, e) => acc + e.timeSpentSeconds, 0)
    const uniqueComments = [...new Set(group.map((e) => e.comment).filter((c): c is string => !!c?.trim()))]
    grouped.push({
      ...latest,
      id: `group-${latest.issueKey.toUpperCase()}`,
      timeSpentSeconds: totalSeconds,
      hours: totalSeconds / 3600,
      comment: uniqueComments.join("; ") || null,
    })
  }
  return grouped
}

// ── Dashboard stats ─────────────────────────────────────────────────────────

type ProjectHours = { key: string; name: string | null; seconds: number }

/**
 * Computes display stats for the Lançamentos DashboardPanel.
 *
 * QA KPIs (totalIssues, criticalCount, jirasBroken, cenariosTestados, cenariosErro)
 * are delegated to `computeJiraKpis` from @/features/qa/lib/jira-stats-kpis — the
 * single source of truth shared with all team dashboards (QA / UX / TW).
 * Non-KPI fields (projectHours, docReviewCount, newDocCount) are computed locally.
 */
function computeStats(entries: LancamentoRow[], brokenTestTypeNames?: string[]) {
  const projectMap = new Map<string, number>()
  const projectNameMap = new Map<string, string>()
  const docReviewIssues = new Set<string>()
  const newDocIssues = new Set<string>()

  const isDocReview = (e: LancamentoRow) =>
    (e.issueType ?? "").toLowerCase() === "documentation review"
  const isNewDoc = (e: LancamentoRow) =>
    (e.issueType ?? "").toLowerCase() === "new documentation"

  for (const e of entries) {
    const pk = e.projectKey || e.issueKey.split("-")[0]
    projectMap.set(pk, (projectMap.get(pk) ?? 0) + e.timeSpentSeconds)
    if (e.projectName?.trim() && !projectNameMap.has(pk)) {
      projectNameMap.set(pk, e.projectName.trim())
    }
    if (isDocReview(e)) docReviewIssues.add(e.issueKey)
    if (isNewDoc(e)) newDocIssues.add(e.issueKey)
  }

  const projectHours: ProjectHours[] = Array.from(projectMap.entries())
    .map(([key, seconds]) => ({ key, name: projectNameMap.get(key) ?? null, seconds }))
    .sort((a, b) => b.seconds - a.seconds)

  // Shared KPI computation — same logic as all team dashboards
  const kpis = computeJiraKpis(entries, brokenTestTypeNames ?? [])

  return {
    projectHours,
    totalIssues: kpis.totalIssues,
    criticalCount: kpis.criticalCount,
    brokenTestCountFromWorklogs: kpis.jirasBroken,
    docReviewCount: docReviewIssues.size,
    newDocCount: newDocIssues.size,
    qtdCenariosTotal: kpis.cenariosTestados,
    // qtdCenariosErroTotal kept for API-compat fallback; same value as cenariosComErroFinalTotal
    qtdCenariosErroTotal: kpis.cenariosErro,
    qtdCenariosQABrokenTestTotal: 0, // deprecated intermediate — no longer needed
    cenariosComErroFinalTotal: kpis.cenariosErro,
  }
}

// ── Dashboard panel ──────────────────────────────────────────────────────────

const STAT_ICON_PALETTE: Record<"brand" | "info" | "warning" | "destructive", { bg: string; fg: string }> = {
  brand:       { bg: "#5C9E8D1A", fg: "#5C9E8D" },
  info:        { bg: "#5C7FA01A", fg: "#5C7FA0" },
  warning:     { bg: "#C9A8701A", fg: "#C9A870" },
  destructive: { bg: "#CB82751A", fg: "#CB8275" },
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconVariant,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  iconVariant: "brand" | "info" | "warning" | "destructive"
}) {
  const palette = STAT_ICON_PALETTE[iconVariant]
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{value}</p>
        </div>
        <div
          className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: palette.bg, color: palette.fg }}
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  )
}

// ── Stacked bar chart ────────────────────────────────────────────────────────

const BAR_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
]

function ProjectStackedBar({ projectHours }: { projectHours: ProjectHours[] }) {
  if (projectHours.length === 0) return null
  const totalSeconds = projectHours.reduce((acc, p) => acc + p.seconds, 0)
  if (totalSeconds === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          <BarChart3 className="size-5" />
        </span>
        <p className="text-sm font-medium text-text-secondary">
          Total horas:{" "}
          <span className="font-semibold text-text-primary">
            {formatDurationHMin(totalSeconds)}
          </span>
        </p>
      </div>
      {/* Stacked bar */}
      <div className="flex h-7 w-full overflow-hidden rounded-md" aria-hidden>
        {projectHours.map((p, i) => (
          <div
            key={p.key}
            title={`${p.name ?? p.key}: ${formatDurationHMin(p.seconds)} (${Math.round((p.seconds / totalSeconds) * 100)}%)`}
            style={{
              width: `${(p.seconds / totalSeconds) * 100}%`,
              backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {projectHours.map((p, i) => (
          <div key={p.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
            />
            <span className="font-medium text-text-primary" title={p.name ?? p.key}>
              {p.name ?? p.key}
            </span>
            <span className="tabular-nums text-text-secondary">
              {formatDurationHMin(p.seconds)}
            </span>
            <span className="tabular-nums text-text-secondary">
              ({Math.round((p.seconds / totalSeconds) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardPanel({
  entries,
  brokenTestSubtasksTotalInScope,
  brokenTestsCreatedByUser,
  brokenTestsOpenedCount,
  reporterBrokenTestIssueCount,
  researchCount,
  usabilityCount,
  docReviewCount,
  newDocCount,
  pendingUxReturnCount,
  qtdCenariosErroTotal: qtdCenariosErroTotalProp,
  evaluatedUserAccessProfile,
  brokenTestIssueTypeNames,
}: {
  entries: LancamentoRow[]
  brokenTestSubtasksTotalInScope?: number
  brokenTestsCreatedByUser?: number
  brokenTestsOpenedCount?: number
  reporterBrokenTestIssueCount?: number
  researchCount?: number
  usabilityCount?: number
  docReviewCount?: number
  newDocCount?: number
  pendingUxReturnCount?: number
  qtdCenariosErroTotal?: number
  evaluatedUserAccessProfile?: "QA" | "UX" | "TW" | "MGR" | null
  brokenTestIssueTypeNames?: string[]
}) {
  const stats = React.useMemo(
    () => computeStats(entries, brokenTestIssueTypeNames),
    [entries, brokenTestIssueTypeNames],
  )
  const profile = evaluatedUserAccessProfile ?? null

  // Para QA: 5 cards (Jiras abertos, Cenários com Erro, Testes Realizados, Total de Jiras, Jiras críticos).
  // Para outros perfis: cards 1 e 2 variam; cards 3 e 4 são invariantes.
  let card1: React.ReactNode
  let card2: React.ReactNode

  if (profile === "UX") {
    card1 = <StatCard icon={Search} label="Pesquisas"   value={researchCount ?? 0}   iconVariant="brand" />
    card2 = <StatCard icon={Users}  label="Usabilidade" value={usabilityCount ?? 0}  iconVariant="warning" />
  } else if (profile === "TW") {
    card1 = <StatCard icon={FileCheck} label="Documentos revisados" value={docReviewCount ?? 0} iconVariant="info" />
    card2 = <StatCard icon={FilePlus}  label="Novos documentos"     value={newDocCount ?? 0}    iconVariant="brand" />
  } else if (profile === "MGR") {
    card1 = <StatCard icon={Briefcase}       label="Operacional" value="Em breve" iconVariant="info" />
    card2 = <StatCard icon={LayoutDashboard} label="Gestão"      value="Em breve" iconVariant="brand" />
  } else {
    // QA: dois novos cards, mais Cenários Testados como 5º card
    const retornoValor = reporterBrokenTestIssueCount ?? 0
    card1 = <StatCard icon={Bug}    label="Retorno de Testes (Broken)" value={retornoValor}                                          iconVariant="warning" />
    card2 = <StatCard icon={AlertTriangle} label="Cenários com Erro" value={qtdCenariosErroTotalProp ?? stats.cenariosComErroFinalTotal} iconVariant="destructive" />
  }

  const isQA = profile === null || profile === "QA"

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Coluna esquerda: stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {card1}
        {card2}
        <StatCard icon={Hash}  label="Total de Jiras"  value={stats.totalIssues}   iconVariant="info" />
        <StatCard icon={Flame} label="Jiras críticos"  value={stats.criticalCount} iconVariant="destructive" />
        {isQA && (
          <div className="col-span-2">
            <StatCard icon={Layers} label="Cenários Testados" value={stats.qtdCenariosTotal} iconVariant="brand" />
          </div>
        )}
      </div>
      {/* Coluna direita: barra de horas */}
      <ProjectStackedBar projectHours={stats.projectHours} />
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

async function fetchLancamentos(
  evaluatedUserId: string,
  from: string,
  to: string,
  preset: LancamentosPeriodPreset,
  signal: AbortSignal,
): Promise<ApiOk> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  async function fetchOnce(f: string, t: string): Promise<ApiOk> {
    const qs = new URLSearchParams({ from: f, to: t, userId: evaluatedUserId, tz })
    const res = await fetch(`/api/jira/lancamentos?${qs}`, { credentials: "same-origin", signal })
    const body = (await res.json().catch(() => null)) as ApiOk | { error?: string } | null
    if (!res.ok) {
      const msg =
        typeof body === "object" && body && "error" in body && typeof body.error === "string"
          ? body.error
          : "Não foi possível carregar os lançamentos."
      throw new Error(msg)
    }
    return body as ApiOk
  }

  const phase1 = await fetchOnce(from, to)

  // Preset "anterior": fase 1 traz 14 dias, fase 2 refina para o dia mais recente com entradas.
  if (preset === "anterior" && from !== to) {
    const maxDate =
      phase1.entries?.reduce((max, e) => {
        const d = e.started?.slice(0, 10) ?? ""
        return d > max ? d : max
      }, "") ?? ""
    if (maxDate) return fetchOnce(maxDate, maxDate)
  }

  return phase1
}

export function IndividualLancamentosSection({
  evaluatedUserId,
  evaluatedUserAccessProfile,
  preset: presetProp,
  onPresetChange,
}: IndividualLancamentosSectionProps) {
  const isControlled = presetProp !== undefined
  const [presetInternal, setPresetInternal] = React.useState<LancamentosPeriodPreset>("week")
  const preset = isControlled ? presetProp : presetInternal
  const [from, setFrom] = React.useState(() => getLancamentosPresetRange("week").from)
  const [to, setTo] = React.useState(() => getLancamentosPresetRange("week").to)
  const [search, setSearch] = React.useState("")
  const toastShownRef = React.useRef(false)

  React.useEffect(() => {
    if (presetProp === undefined) return
    const r = getLancamentosPresetRange(presetProp)
    setFrom(r.from)
    setTo(r.to)
  }, [presetProp])

  // Credenciais verificadas uma vez por sessão — staleTime: Infinity evita refetch.
  const credentialsQuery = useQuery({
    queryKey: ["jira-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      if (!res.ok) return { configured: false, jiraUrl: "" }
      return res.json() as Promise<{ jiraUrl?: string; configured?: boolean }>
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const jiraConfigured = credentialsQuery.data?.configured ?? null

  React.useEffect(() => {
    if (jiraConfigured !== false) return
    if (toastShownRef.current) return
    toastShownRef.current = true
    toast.warning("Integração com Jira não configurada", {
      description: "Configure sua conta Jira em Configurações para visualizar os lançamentos.",
      action: {
        label: "Configurações",
        onClick: () => { window.location.href = "/configuracoes" },
      },
      duration: 8000,
    })
  }, [jiraConfigured])

  const lancamentosQuery = useQuery({
    queryKey: ["lancamentos", evaluatedUserId, from, to, preset],
    queryFn: ({ signal }) => fetchLancamentos(evaluatedUserId, from, to, preset, signal),
    enabled: jiraConfigured === true,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })

  function applyPreset(p: LancamentosPeriodPreset) {
    const r = getLancamentosPresetRange(p)
    if (!isControlled) setPresetInternal(p)
    onPresetChange?.(p)
    setFrom(r.from)
    setTo(r.to)
  }

  const data = lancamentosQuery.data ?? null
  const isLoading = credentialsQuery.isLoading || lancamentosQuery.isLoading
  const isFetching = lancamentosQuery.isFetching
  const error = lancamentosQuery.error ? (lancamentosQuery.error as Error).message : null
  const jiraBase = data?.jiraBrowseBase?.trim() ? data.jiraBrowseBase.replace(/\/$/, "") : null

  const allEntries = data?.entries ?? []

  // Group raw entries by issueKey — dashboard uses allEntries (unmerged),
  // table and toolbar use grouped entries.
  const groupedEntries = React.useMemo(() => groupByIssueKey(allEntries), [allEntries])

  const filtered = React.useMemo(() => {
    if (!search.trim()) return groupedEntries
    const q = search.trim().toLowerCase()
    return groupedEntries.filter(
      (e) =>
        e.issueKey.toLowerCase().includes(q) ||
        (e.summary ?? "").toLowerCase().includes(q),
    )
  }, [groupedEntries, search])

  const toolbarLeadingSummary = (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-text-primary">
        Lançamentos:{" "}
        <span className="font-bold">{filtered.length.toLocaleString("pt-BR")}</span>
      </span>
      {isFetching && !isLoading && (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-text-secondary"
        >
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Atualizando…
        </span>
      )}
    </div>
  )

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Preset filter — só visível no modo autônomo (sem parent controlando) */}
      {!isControlled && (
        <div className="flex items-center gap-3">
          <Select
            value={preset}
            onValueChange={(v) => applyPreset(v as LancamentosPeriodPreset)}
            aria-label="Período"
          >
            <SelectTrigger className="w-44">
              <SelectValue>{getLancamentosPresetLabel(preset)}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {LANCAMENTOS_PRESET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      )}

      {jiraConfigured === false ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border-default bg-surface-card py-16 text-center shadow-card">
          <span className="flex size-14 items-center justify-center rounded-full bg-badge-warning/10">
            <PlugZap className="size-7 text-badge-warning-text" aria-hidden />
          </span>
          <div className="max-w-sm">
            <p className="text-base font-semibold text-text-primary">Integração com Jira não configurada</p>
            <p className="mt-1 text-sm text-text-secondary">
              Configure sua conta Jira para visualizar os lançamentos e estatísticas de trabalho.
            </p>
          </div>
          <a
            href="/configuracoes"
            className="inline-flex items-center gap-2 rounded-custom border border-border-default bg-surface-input px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Ir para Configurações
          </a>
        </div>
      ) : isLoading ? (
        <SectionSpinner />
      ) : error ? (
        <EmptyState message={`Erro: ${error}`} />
      ) : data ? (
        <>
          {data.noJiraUser && data.entries.length > 0 ? (
            <div
              className="rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm text-text-secondary"
              role="status"
            >
              <p className="font-medium text-text-primary">Utilizador Jira não encontrado por e-mail</p>
              <p className="mt-1">
                A tabela pode mostrar apenas lançamentos vindos da API Clockwork. Associe o mesmo e-mail no Jira
                para alinhar worklogs nativos.
              </p>
            </div>
          ) : null}

          {allEntries.length > 0 && (data.truncatedIssues || data.truncatedWorklogs) ? (
            <p className="text-sm text-text-secondary">
              {data.truncatedIssues
                ? "Lista de issues truncada (limite do servidor). Reduza o intervalo para ver mais."
                : null}
              {data.truncatedIssues && data.truncatedWorklogs ? " " : ""}
              {data.truncatedWorklogs
                ? "Lista de lançamentos truncada (limite do servidor). Reduza o intervalo."
                : null}
            </p>
          ) : null}

          {/* Dashboard totals — use raw allEntries so project aggregation is accurate */}
          {allEntries.length > 0 && (
            <DashboardPanel
              entries={allEntries}
              brokenTestSubtasksTotalInScope={data.brokenTestSubtasksTotalInScope}
              brokenTestsCreatedByUser={data.brokenTestsCreatedByUser}
              brokenTestsOpenedCount={data.brokenTestsOpenedCount}
              reporterBrokenTestIssueCount={data.reporterBrokenTestIssueCount}
              researchCount={data.researchCount}
              usabilityCount={data.usabilityCount}
              docReviewCount={data.docReviewCount}
              newDocCount={data.newDocCount}
              pendingUxReturnCount={data.pendingUxReturnCount}
              qtdCenariosErroTotal={data.qtdCenariosErroTotal}
              evaluatedUserAccessProfile={evaluatedUserAccessProfile}
              brokenTestIssueTypeNames={data.brokenTestIssueTypeNames}
            />
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
            <TableToolbar
              search={search}
              onSearchChange={(v) => setSearch(v)}
              searchPlaceholder="Buscar por Jira ou título…"
              leadingSummary={toolbarLeadingSummary}
              baseCount={groupedEntries.length}
            />

            {filtered.length === 0 ? (
              <EmptyState message="Nenhum registro encontrado." className="mx-5 my-8" />
            ) : (
              <div className="overflow-x-auto">
                {(() => {
                  const showTagCol = evaluatedUserAccessProfile === "TW" || evaluatedUserAccessProfile === "UX"
                  const thCls = "px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4"
                  return (
                  <table className="qagrotis-table-row-hover-muted w-full min-w-[56rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-neutral-grey-50">
                      <th className={thCls}>Jira</th>
                      <th className={thCls}>Tipo</th>
                      <th className={thCls}>Projeto</th>
                      <th className={thCls}>Prioridade</th>
                      <th className={thCls}>Título</th>
                      <th className={thCls}>Data</th>
                      <th className={thCls}>Tempo</th>
                      <th className={thCls}>Comentário</th>
                      <th className={thCls}>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const excesso = row.timeSpentSeconds / 3600 > 8
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-border-default last:border-b-0 transition-colors"
                        >
                          {/* Jira */}
                          <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                            {jiraBase ? (
                              <a
                                href={`${jiraBase}/browse/${encodeURIComponent(row.issueKey)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-brand-primary tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                              >
                                {row.issueKey}
                              </a>
                            ) : (
                              <span className="font-semibold tabular-nums text-text-primary">{row.issueKey}</span>
                            )}
                          </td>
                          {/* Tipo */}
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-text-secondary sm:px-4">
                            {row.issueType?.trim() ? row.issueType : "—"}
                          </td>
                          {/* Projeto — tag para TW/UX; projectName para demais perfis */}
                          <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-text-primary sm:px-4">
                            {showTagCol
                              ? (row.tag?.trim() || "—")
                              : (row.projectName?.trim() || row.projectKey || row.issueKey.split("-")[0])}
                          </td>
                          {/* Prioridade */}
                          <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                            <JiraPriorityBadge priority={row.priority} />
                          </td>
                          {/* Título */}
                          <td className="max-w-[16rem] px-3 py-3 text-sm text-text-primary sm:px-4">
                            <span className="block truncate" title={row.summary ?? undefined}>
                              {row.summary ?? "—"}
                            </span>
                          </td>
                          {/* Data */}
                          <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-text-primary sm:px-4">
                            {new Date(row.started).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          {/* Tempo */}
                          <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums font-medium text-text-primary sm:px-4">
                            {formatDurationHMin(row.timeSpentSeconds)}
                          </td>
                          {/* Comentário */}
                          <td className="max-w-[18rem] px-3 py-3 text-sm text-text-secondary sm:px-4">
                            <span className="block truncate" title={row.comment ?? undefined}>
                              {row.comment ?? "—"}
                            </span>
                          </td>
                          {/* Situação */}
                          <td className="px-3 py-3 text-center sm:px-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex w-full items-center justify-center">
                                  {excesso ? (
                                    <AlertTriangle
                                      className="size-4 shrink-0 text-badge-warning-text"
                                      aria-label="Excesso de horas"
                                    />
                                  ) : (
                                    <CheckCircle2
                                      className="size-4 shrink-0 text-badge-success-text"
                                      aria-label="Dentro do limite"
                                    />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {excesso ? "Excesso de horas (> 8h nesta atividade)." : "Dentro do limite de 8h."}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                  )
                })()}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
