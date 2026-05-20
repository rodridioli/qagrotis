"use client"

import * as React from "react"
import { Clock, DollarSign, Layers, MousePointer, Search, Wrench } from "lucide-react"
import { cn } from "@/core/utils"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { UserAvatar } from "@/features/equipe/components/EquipePerformanceCard"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getUxWorklogsForYear } from "@/features/qa/actions/jira-worklog-cache"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { ProgressaoHistoricoEntry } from "@/features/individual/actions/individual-progressao"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  membros: EquipeMembroLancamentos[]
  /** Histórico completo de progressão por userId, ordenado por data DESC. */
  progressaoMap: Record<string, ProgressaoHistoricoEntry[]>
}

interface JiraEntry {
  issueKey: string
  projectName?: string | null
  typeField?: string | null
  status?: string | null
  started: string
  timeSpentSeconds: number
}

interface MonthStats {
  totalSeconds: number
  novosPrototipos: number
  melhorias: number
  pesquisa: number
  usabilidade: number
  aguardando: number
  investimentoCentavos: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março",
  "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro",
  "Outubro", "Novembro", "Dezembro",
]

const QUARTERS = [
  { label: "1º Trimestre", months: [0, 1, 2] },
  { label: "2º Trimestre", months: [3, 4, 5] },
  { label: "3º Trimestre", months: [6, 7, 8] },
  { label: "4º Trimestre", months: [9, 10, 11] },
]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatHHMM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${String(h)}:${pad(m)}`
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDurationAvg(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${pad(m)}min`
}

function emptyMonthStats(): MonthStats {
  return {
    totalSeconds: 0,
    novosPrototipos: 0,
    melhorias: 0,
    pesquisa: 0,
    usabilidade: 0,
    aguardando: 0,
    investimentoCentavos: 0,
  }
}

function sumStats(a: MonthStats, b: MonthStats): MonthStats {
  return {
    totalSeconds: a.totalSeconds + b.totalSeconds,
    novosPrototipos: a.novosPrototipos + b.novosPrototipos,
    melhorias: a.melhorias + b.melhorias,
    pesquisa: a.pesquisa + b.pesquisa,
    usabilidade: a.usabilidade + b.usabilidade,
    aguardando: a.aguardando + b.aguardando,
    investimentoCentavos: a.investimentoCentavos + b.investimentoCentavos,
  }
}

/**
 * Retorna o valorHora (centavos) vigente para um dado mês/ano.
 * Usa o registro de progressão mais recente com data ≤ último dia do mês.
 * Se não houver registro anterior, usa o mais antigo disponível (fallback).
 */
function getValorHoraForMonth(
  history: ProgressaoHistoricoEntry[],
  year: number,
  monthIndex: number,
): number | null {
  const lastDay = `${year}-${pad(monthIndex + 1)}-${pad(new Date(year, monthIndex + 1, 0).getDate())}`
  const active = history.find((r) => r.dataYmd <= lastDay && r.valorHora != null)
  if (active) return active.valorHora
  const fallback = [...history].reverse().find((r) => r.valorHora != null)
  return fallback?.valorHora ?? null
}

/**
 * Agrega entries de um único membro por mês.
 * O valorHora é determinado dinamicamente para cada mês com base no histórico de progressão.
 */
function aggregateByMonth(
  entries: JiraEntry[],
  progressaoHistory: ProgressaoHistoricoEntry[],
  year: number,
): MonthStats[] {
  type Bucket = {
    seconds: number
    novosProto: Set<string>
    melhorias: Set<string>
    pesq: Set<string>
    usabilidade: Set<string>
    ag: Set<string>
  }
  const byMonth: Map<number, Bucket> = new Map()
  for (let i = 0; i < 12; i++) {
    byMonth.set(i, {
      seconds: 0,
      novosProto: new Set(),
      melhorias: new Set(),
      pesq: new Set(),
      usabilidade: new Set(),
      ag: new Set(),
    })
  }

  for (const e of entries) {
    const datePart = e.started.slice(0, 10)
    const month = new Date(`${datePart}T12:00:00`).getMonth()
    if (month < 0 || month > 11) continue
    const bucket = byMonth.get(month)!
    bucket.seconds += e.timeSpentSeconds
    const tf = (e.typeField ?? "").trim().toLowerCase()
    if (tf === "new" || tf === "redesign") bucket.novosProto.add(e.issueKey)
    if (tf === "ajust/return" || tf === "improvement") bucket.melhorias.add(e.issueKey)
    if (tf === "research") bucket.pesq.add(e.issueKey)
    if (tf === "usability") bucket.usabilidade.add(e.issueKey)
    if (e.status?.toLowerCase().trim() === "approval") bucket.ag.add(e.issueKey)
  }

  return Array.from({ length: 12 }, (_, i) => {
    const bucket = byMonth.get(i)!
    const hours = bucket.seconds / 3600
    const valorHora = getValorHoraForMonth(progressaoHistory, year, i)
    const investimento = valorHora != null ? Math.round(hours * valorHora) : 0
    return {
      totalSeconds: bucket.seconds,
      novosPrototipos: bucket.novosProto.size,
      melhorias: bucket.melhorias.size,
      pesquisa: bucket.pesq.size,
      usabilidade: bucket.usabilidade.size,
      aguardando: bucket.ag.size,
      investimentoCentavos: investimento,
    }
  })
}

function buildTopItems(map: Map<string, Set<string>>) {
  const sorted = [...map.entries()]
    .map(([label, keys]) => ({ label, count: keys.size }))
    .sort((a, b) => b.count - a.count)
  if (sorted.length <= 5) return sorted
  const top4 = sorted.slice(0, 4)
  const otherCount = sorted.slice(4).reduce((s, x) => s + x.count, 0)
  return [...top4, { label: "Outros", count: otherCount, isOther: true }]
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconVariant,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconVariant: "brand" | "warning" | "success" | "info"
}) {
  const iconCls = cn(
    "hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg",
    iconVariant === "brand"   && "bg-brand-primary/10 text-brand-primary",
    iconVariant === "warning" && "bg-badge-warning/10 text-badge-warning-text",
    iconVariant === "success" && "bg-badge-success/10 text-badge-success-text",
    iconVariant === "info"    && "bg-badge-info/10 text-badge-info-text",
  )
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
        </div>
        <div className={iconCls}>
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  )
}

// ─── ProductRankCard ──────────────────────────────────────────────────────────

function ProductRankCard({
  title,
  items,
}: {
  title: string
  items: { label: string; count: number; isOther?: boolean }[]
}) {
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="mb-3 text-sm font-semibold text-text-primary">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Sem dados no período.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
              <span
                className={cn(
                  "min-w-0 truncate font-medium",
                  item.isOther ? "text-badge-success-text" : "text-text-primary",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  item.isOther ? "text-badge-success-text" : "text-text-secondary",
                )}
              >
                {item.count} {item.count === 1 ? "protótipo" : "protótipos"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── YearTable ────────────────────────────────────────────────────────────────

function YearTable({ monthStats }: { monthStats: MonthStats[] }) {
  const totalAnual = monthStats.reduce(sumStats, emptyMonthStats())

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Trimestre
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Horas
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Investimento
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Novos Protótipos
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Melhorias
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Pesquisa
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Usabilidade
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Aguardando
            </th>
          </tr>
        </thead>
        <tbody>
          {QUARTERS.map((q) => {
            const qStats = q.months.reduce(
              (acc, mi) => sumStats(acc, monthStats[mi]!),
              emptyMonthStats(),
            )
            return (
              <React.Fragment key={q.label}>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{q.label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {formatHHMM(qStats.totalSeconds)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {formatBRL(qStats.investimentoCentavos)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.novosPrototipos}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.melhorias}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.pesquisa}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.usabilidade}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.aguardando}
                  </td>
                </tr>
                {q.months.map((mi) => {
                  const ms = monthStats[mi]!
                  return (
                    <tr
                      key={mi}
                      className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/50"
                    >
                      <td className="px-4 py-2 pl-8 text-text-secondary">{MONTHS_PT[mi]}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {formatHHMM(ms.totalSeconds)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {formatBRL(ms.investimentoCentavos)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.novosPrototipos}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.melhorias}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.pesquisa}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.usabilidade}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.aguardando}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}

          <tr className="border-t-2 border-border-default bg-neutral-grey-50">
            <td className="px-4 py-2.5 font-bold text-text-primary">Total</td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {formatHHMM(totalAnual.totalSeconds)}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {formatBRL(totalAnual.investimentoCentavos)}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.novosPrototipos}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.melhorias}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.pesquisa}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.usabilidade}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.aguardando}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function UxDashboardClient({ membros, progressaoMap }: Props) {
  const currentYear = new Date().getFullYear()
  const [ano, setAno] = React.useState(currentYear)
  const [loading, setLoading] = React.useState(false)
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
  // Raw entries per userId — fetched once per year, filtered in useMemo
  const [rawMemberEntries, setRawMemberEntries] = React.useState<Record<string, JiraEntry[]>>({})

  // Only current year and previous year
  const yearOptions = React.useMemo(
    () => [currentYear, currentYear - 1],
    [currentYear],
  )

  // Active members: all when no selection, filtered otherwise
  const activeMembers = React.useMemo(
    () =>
      selectedUserIds.length > 0
        ? membros.filter((m) => selectedUserIds.includes(m.userId))
        : membros,
    [membros, selectedUserIds],
  )

  // Toggle a user in/out of the selection
  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  // ── Derived stats (instant — no fetch on user toggle) ─────────────────────
  const { monthStats, totalUniqueIssues, protoByProduct, agByProduct } = React.useMemo(() => {
    if (Object.keys(rawMemberEntries).length === 0) {
      return {
        monthStats: null,
        totalUniqueIssues: 0,
        protoByProduct: [] as { label: string; count: number; isOther?: boolean }[],
        agByProduct: [] as { label: string; count: number; isOther?: boolean }[],
      }
    }

    const combined: MonthStats[] = Array.from({ length: 12 }, emptyMonthStats)
    const allEntries: JiraEntry[] = []

    for (const m of activeMembers) {
      const entries = rawMemberEntries[m.userId] ?? []
      allEntries.push(...entries)
      const history = progressaoMap[m.userId] ?? []
      const memberStats = aggregateByMonth(entries, history, ano)
      for (let i = 0; i < 12; i++) {
        combined[i] = sumStats(combined[i]!, memberStats[i]!)
      }
    }

    const protoMap = new Map<string, Set<string>>()
    const agMap = new Map<string, Set<string>>()
    for (const e of allEntries) {
      const tf = (e.typeField ?? "").trim().toLowerCase()
      const proj = e.projectName?.trim() || e.issueKey.split("-")[0] || "Outros"
      if (tf === "new" || tf === "redesign") {
        if (!protoMap.has(proj)) protoMap.set(proj, new Set())
        protoMap.get(proj)!.add(e.issueKey)
      }
      if (e.status?.toLowerCase().trim() === "approval") {
        if (!agMap.has(proj)) agMap.set(proj, new Set())
        agMap.get(proj)!.add(e.issueKey)
      }
    }

    return {
      monthStats: combined,
      totalUniqueIssues: new Set(allEntries.map((e) => e.issueKey)).size,
      protoByProduct: buildTopItems(protoMap),
      agByProduct: buildTopItems(agMap),
    }
  }, [rawMemberEntries, activeMembers, progressaoMap, ano])

  // ── Derived totals for metric cards ───────────────────────────────────────
  const totalAnual = React.useMemo(
    () => (monthStats ?? []).reduce(sumStats, emptyMonthStats()),
    [monthStats],
  )

  const avgValorHora = React.useMemo(() => {
    const refMonth = ano === new Date().getFullYear() ? new Date().getMonth() : 11
    const rates = activeMembers
      .map((m) => getValorHoraForMonth(progressaoMap[m.userId] ?? [], ano, refMonth))
      .filter((v): v is number => v != null)
    return rates.length > 0 ? rates.reduce((s, v) => s + v, 0) / rates.length : null
  }, [activeMembers, progressaoMap, ano])

  const avgSecondsPerIssue = totalUniqueIssues > 0
    ? Math.round(totalAnual.totalSeconds / totalUniqueIssues)
    : 0
  const avgInvestimentoCentavos =
    avgValorHora != null ? Math.round(avgValorHora * (avgSecondsPerIssue / 3600)) : 0

  // ── Fetch all members on year change (uses cache) ─────────────────────────
  const fetchAll = React.useCallback(
    async (year: number) => {
      if (membros.length === 0) {
        setRawMemberEntries({})
        return
      }
      setRawMemberEntries({})
      setLoading(true)
      try {
        const results = await Promise.all(
          membros.map(async (m) => {
            try {
              const { entries } = await getUxWorklogsForYear(m.userId, year)
              return [m.userId, entries] as const
            } catch {
              return [m.userId, [] as JiraEntry[]] as const
            }
          }),
        )
        setRawMemberEntries(Object.fromEntries(results))
      } finally {
        setLoading(false)
      }
    },
    [membros],
  )

  React.useEffect(() => {
    void fetchAll(ano)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano])

  // ── Render ───────────────────────────────────────────────────────────────
  const hasSelection = selectedUserIds.length > 0

  return (
    <div className="min-w-0 space-y-6">
      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Year selector — DS Select, same pattern as DashboardCharts.tsx FilterSelect */}
        <Select
          value={String(ano)}
          onValueChange={(v) => { if (v) setAno(Number(v)) }}
        >
          <SelectTrigger
            className="h-8 w-auto shrink-0 text-xs"
            aria-label="Selecionar ano"
          >
            <SelectValue>{ano}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {/* Team avatar filters */}
        <div className="flex items-center -space-x-2">
          {membros.slice(0, 6).map((m) => {
            const isSelected = selectedUserIds.includes(m.userId)
            const dimmed = hasSelection && !isSelected
            return (
              <Tooltip key={m.userId}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => toggleUser(m.userId)}
                      aria-label={`Filtrar por ${m.name}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
                        dimmed && "opacity-40",
                      )}
                    />
                  }
                >
                  <UserAvatar
                    name={m.name}
                    photoPath={m.photoPath}
                    size={36}
                    className={cn(
                      "ring-2 transition-all duration-150",
                      isSelected
                        ? "ring-brand-primary"
                        : "ring-surface-card",
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>{m.name}</TooltipContent>
              </Tooltip>
            )
          })}
          {membros.length > 6 && (
            <div
              className="flex size-9 items-center justify-center rounded-full bg-neutral-grey-100 text-xs font-semibold text-text-secondary ring-2 ring-surface-card"
              aria-hidden
            >
              +{membros.length - 6}
            </div>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          label="Tempo Médio por Atividade"
          value={loading ? "—" : formatDurationAvg(avgSecondsPerIssue)}
          icon={Clock}
          iconVariant="brand"
        />
        <MetricCard
          label="Valor Médio Investido"
          value={loading ? "—" : formatBRL(avgInvestimentoCentavos)}
          icon={DollarSign}
          iconVariant="success"
        />
        <MetricCard
          label="Protótipos Novos"
          value={loading ? "—" : String(totalAnual.novosPrototipos)}
          icon={Layers}
          iconVariant="warning"
        />
        <MetricCard
          label="Pesquisas no período"
          value={loading ? "—" : String(totalAnual.pesquisa)}
          icon={Search}
          iconVariant="info"
        />
        <MetricCard
          label="Usabilidade"
          value={loading ? "—" : String(totalAnual.usabilidade)}
          icon={MousePointer}
          iconVariant="brand"
        />
        <MetricCard
          label="Melhorias"
          value={loading ? "—" : String(totalAnual.melhorias)}
          icon={Wrench}
          iconVariant="warning"
        />
      </div>

      {/* Product breakdown cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProductRankCard
            title="Qtd. de Protótipos por Produto no período"
            items={protoByProduct}
          />
          <ProductRankCard
            title="Aguardando Aprovação no período"
            items={agByProduct.map((i) => ({ ...i }))}
          />
        </div>
      )}

      {/* Yearly table */}
      {loading || monthStats === null ? (
        <SectionSpinner minHeight="min-h-[300px]" />
      ) : (
        <YearTable monthStats={monthStats} />
      )}
    </div>
  )
}
