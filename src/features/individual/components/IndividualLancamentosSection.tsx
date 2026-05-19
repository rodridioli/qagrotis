"use client"

import * as React from "react"
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
  Search,
  Users,
} from "lucide-react"
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

function normalizePriorityToken(p: string): string {
  return p
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function priorityIsCritical(p: string | null | undefined): boolean {
  if (!p?.trim()) return false
  const n = normalizePriorityToken(p)
  return (
    n === "critical" ||
    n === "critico" ||
    n === "highest" ||
    n === "critica" ||
    n === "alta" ||
    n === "blocker" ||
    n === "imediato" ||
    n.includes("critical") ||
    n.includes("critica") ||
    n.includes("critico")
  )
}

function computeStats(entries: LancamentoRow[]) {
  const projectMap = new Map<string, number>()
  const projectNameMap = new Map<string, string>()
  const issueSet = new Set<string>()
  const criticalIssues = new Set<string>()
  const brokenTestIssues = new Set<string>()
  const docReviewIssues = new Set<string>()
  const newDocIssues = new Set<string>()
  const qtdByIssue = new Map<string, number>()
  const qtdErroByIssue = new Map<string, number>()

  const isBrokenTest = (e: LancamentoRow) =>
    (e.issueType ?? "").toLowerCase().includes("broken")
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
    issueSet.add(e.issueKey)
    if (priorityIsCritical(e.priority)) criticalIssues.add(e.issueKey)
    if (isBrokenTest(e)) brokenTestIssues.add(e.issueKey)
    if (isDocReview(e)) docReviewIssues.add(e.issueKey)
    if (isNewDoc(e)) newDocIssues.add(e.issueKey)
    if (e.qtdCenariosQA != null && Number.isFinite(e.qtdCenariosQA)) {
      const prev = qtdByIssue.get(e.issueKey) ?? 0
      qtdByIssue.set(e.issueKey, Math.max(prev, e.qtdCenariosQA))
    }
    if (e.qtdCenariosErro != null && Number.isFinite(e.qtdCenariosErro)) {
      const prev = qtdErroByIssue.get(e.issueKey) ?? 0
      qtdErroByIssue.set(e.issueKey, Math.max(prev, e.qtdCenariosErro))
    }
  }

  let qtdCenariosTotal = 0
  for (const v of qtdByIssue.values()) {
    qtdCenariosTotal += v
  }

  let qtdCenariosErroTotal = 0
  for (const v of qtdErroByIssue.values()) {
    qtdCenariosErroTotal += v
  }

  const projectHours: ProjectHours[] = Array.from(projectMap.entries())
    .map(([key, seconds]) => ({ key, name: projectNameMap.get(key) ?? null, seconds }))
    .sort((a, b) => b.seconds - a.seconds)

  return {
    projectHours,
    totalIssues: issueSet.size,
    criticalCount: criticalIssues.size,
    brokenTestCountFromWorklogs: brokenTestIssues.size,
    docReviewCount: docReviewIssues.size,
    newDocCount: newDocIssues.size,
    qtdCenariosTotal,
    qtdCenariosErroTotal,
  }
}

// ── Dashboard panel ──────────────────────────────────────────────────────────

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
  const iconCls = cn(
    "hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg",
    iconVariant === "brand"       && "bg-brand-primary/10 text-brand-primary",
    iconVariant === "info"        && "bg-badge-info/10 text-badge-info-text",
    iconVariant === "warning"     && "bg-badge-warning/10 text-badge-warning-text",
    iconVariant === "destructive" && "bg-destructive/10 text-destructive",
  )
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{value}</p>
        </div>
        <div className={iconCls}>
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  )
}

// ── Stacked bar chart ────────────────────────────────────────────────────────

const BAR_COLORS = [
  "var(--color-brand-primary)",
  "var(--color-secondary-500)",
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
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
}) {
  const stats = React.useMemo(() => computeStats(entries), [entries])

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
    // QA: dois novos cards, mais Testes Realizados como 5º card
    const retornoValor =
      brokenTestSubtasksTotalInScope ||
      reporterBrokenTestIssueCount ||
      brokenTestsCreatedByUser ||
      brokenTestsOpenedCount ||
      stats.brokenTestCountFromWorklogs
    card1 = <StatCard icon={Bug}    label="Jiras abertos (Broken)" value={retornoValor}                                          iconVariant="warning" />
    card2 = <StatCard icon={AlertTriangle} label="Cenários com Erro" value={qtdCenariosErroTotalProp ?? stats.qtdCenariosErroTotal} iconVariant="destructive" />
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
            <StatCard icon={Layers} label="Testes Realizados" value={stats.qtdCenariosTotal} iconVariant="brand" />
          </div>
        )}
      </div>
      {/* Coluna direita: barra de horas */}
      <ProjectStackedBar projectHours={stats.projectHours} />
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

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
  // Tracks whether the "anterior" two-phase refinement is in progress
  const [anteriormenteRefining, setAnteriormenteRefining] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ApiOk | null>(null)
  const [jiraBase, setJiraBase] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  // AbortController para cancelar requisições em voo ao trocar filtros
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (presetProp === undefined) return
    const r = getLancamentosPresetRange(presetProp)
    setAnteriormenteRefining(false)
    setFrom(r.from)
    setTo(r.to)
  }, [presetProp])

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/jira/credentials", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { jiraUrl?: string } | null) => {
        if (cancelled || !d?.jiraUrl?.trim()) return
        setJiraBase((prev) => prev ?? String(d.jiraUrl).replace(/\/$/, ""))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const load = React.useCallback(async () => {
    // Aborta qualquer requisição anterior em voo antes de iniciar uma nova
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      from,
      to,
      userId: evaluatedUserId,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    try {
      const res = await fetch(`/api/jira/lancamentos?${qs}`, {
        credentials: "same-origin",
        signal,
      })
      if (signal.aborted) return

      const body = (await res.json().catch(() => null)) as ApiOk | { error?: string } | null
      if (signal.aborted) return

      if (!res.ok) {
        const msg =
          typeof body === "object" && body && "error" in body && typeof body.error === "string"
            ? body.error
            : "Não foi possível carregar os lançamentos."
        throw new Error(msg)
      }
      const ok = body as ApiOk

      // "Anterior": fase 1 — 14 dias até ontem. Refina para o dia mais recente com entradas.
      // Keep loading=true so the spinner stays alive while phase 2 runs.
      if (preset === "anterior" && !anteriormenteRefining && from !== to) {
        const maxDate = ok.entries?.reduce((max, e) => {
          const d = e.started?.slice(0, 10) ?? ""
          return d > max ? d : max
        }, "") ?? ""
        if (maxDate) {
          setAnteriormenteRefining(true)
          setFrom(maxDate)
          setTo(maxDate)
          return // loading stays true — phase 2 will clear it
        }
      }
      setAnteriormenteRefining(false)
      setData(ok)
      setLoading(false)
      if (ok.jiraBrowseBase?.trim()) {
        setJiraBase(ok.jiraBrowseBase.replace(/\/$/, ""))
      }
    } catch (e) {
      // Ignora erros de requisições abortadas — não atualiza estado
      if (signal.aborted) return
      setAnteriormenteRefining(false)
      setData(null)
      setError(e instanceof Error ? e.message : "Erro ao carregar.")
      setLoading(false)
    }
  }, [evaluatedUserId, from, to, preset, anteriormenteRefining])

  React.useEffect(() => {
    void load()
    // Aborta a requisição em voo ao desmontar ou quando load mudar (novo filtro)
    return () => { abortRef.current?.abort() }
  }, [load])

  function applyPreset(p: LancamentosPeriodPreset) {
    const r = getLancamentosPresetRange(p)
    if (!isControlled) setPresetInternal(p)
    onPresetChange?.(p)
    setAnteriormenteRefining(false)
    setFrom(r.from)
    setTo(r.to)
    // Clear stale data immediately so the spinner shows before the effect fires.
    setData(null)
    setLoading(true)
  }

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
    <span className="text-sm font-medium text-text-primary">
      Lançamentos:{" "}
      <span className="font-bold">{filtered.length.toLocaleString("pt-BR")}</span>
    </span>
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

      {loading ? (
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
                <table className="qagrotis-table-row-hover-muted w-full min-w-[56rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-neutral-grey-50">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Jira</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Tipo</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Projeto</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Prioridade</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Título</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Data</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Tempo</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Comentário</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Situação</th>
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
                          {/* Projeto */}
                          <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-text-primary sm:px-4">
                            {row.projectName?.trim() || row.projectKey || row.issueKey.split("-")[0]}
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
                                      className="size-4 shrink-0 text-amber-500"
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
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
