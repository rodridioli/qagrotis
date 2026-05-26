"use client"

import * as React from "react"
import { AlertTriangle, BarChart2, CheckSquare2, Clock, DollarSign, Eye, EyeOff, Flame, RefreshCw } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, Cell, YAxis, ResponsiveContainer, XAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line } from "recharts"
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getUxWorklogsForYear, type BtMonthStats } from "@/features/qa/actions/jira-worklog-cache"
import { priorityIsCritical } from "@/features/qa/lib/jira-stats-kpis"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { ProgressaoHistoricoEntry } from "@/features/individual/actions/individual-progressao"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  membros: EquipeMembroLancamentos[]
  progressaoMap: Record<string, ProgressaoHistoricoEntry[]>
  brokenTestIssueTypeNames: string[]
}

interface JiraEntry {
  issueKey: string
  projectName?: string | null
  typeField?: string | null
  issueType?: string | null
  status?: string | null
  tag?: string | null
  priority?: string | null
  retornos?: number
  retornosByAssignee?: Record<string, number>
  authorJiraAccountId?: string | null
  qtdCenariosQA: number
  qtdCenariosErro: number
  started: string
  timeSpentSeconds: number
}

interface QaMonthStats {
  totalSeconds: number
  totalIssues: number
  cenariosTestados: number
  cenariosErro: number
  jirasBroken: number
  criticos: number
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

// ─── Period filter utilities ───────────────────────────────────────────────────

const PERIOD_MONTHS: Record<string, number[]> = {
  Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11],
  H1: [0, 1, 2, 3, 4, 5], H2: [6, 7, 8, 9, 10, 11],
  FULL: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

function parsePeriod(value: string, fallbackYear: number): { year: number; activeMonths: number[] } {
  const dashIdx = value.lastIndexOf("-")
  const type = dashIdx > 0 ? value.slice(0, dashIdx) : value
  const yearStr = dashIdx > 0 ? value.slice(dashIdx + 1) : ""
  const year = yearStr ? Number(yearStr) : fallbackYear
  const months = PERIOD_MONTHS[type] ?? PERIOD_MONTHS.FULL!
  return { year, activeMonths: months }
}

function buildPeriodOptions(currentYear: number) {
  const MIN_YEAR = 2026
  const years: number[] = []
  for (let y = currentYear; y >= MIN_YEAR; y--) years.push(y)
  return years.map((y) => ({ value: `FULL-${y}`, label: String(y), group: "y" as const }))
}

function defaultPeriodValue(currentYear: number): string {
  return `FULL-${currentYear}`
}

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

function emptyQaMonthStats(): QaMonthStats {
  return {
    totalSeconds: 0,
    totalIssues: 0,
    cenariosTestados: 0,
    cenariosErro: 0,
    jirasBroken: 0,
    criticos: 0,
    investimentoCentavos: 0,
  }
}

function sumQaStats(a: QaMonthStats, b: QaMonthStats): QaMonthStats {
  return {
    totalSeconds: a.totalSeconds + b.totalSeconds,
    totalIssues: a.totalIssues + b.totalIssues,
    cenariosTestados: a.cenariosTestados + b.cenariosTestados,
    cenariosErro: a.cenariosErro + b.cenariosErro,
    jirasBroken: a.jirasBroken + b.jirasBroken,
    criticos: a.criticos + b.criticos,
    investimentoCentavos: a.investimentoCentavos + b.investimentoCentavos,
  }
}

/**
 * Retorna o valorHora (centavos) vigente para um dado mês/ano.
 * Mantido para uso em métricas de resumo (avgValorHora).
 */
function getValorHoraForMonth(
  history: ProgressaoHistoricoEntry[],
  year: number,
  monthIndex: number,
): number | null {
  const lastDay = `${year}-${pad(monthIndex + 1)}-${pad(new Date(year, monthIndex + 1, 0).getDate())}`
  const active = history.find((r) => r.dataYmd <= lastDay && r.valorHora != null)
  if (active) return active.valorHora
  return null
}

/**
 * Retorna o valorHora (centavos) vigente na data exata de um lançamento.
 * Mais preciso que getValorHoraForMonth: aplica a taxa correta para cada entrada,
 * respeitando mudanças de progressão que ocorrem no meio de um mês.
 * history deve estar ordenado por data DESC.
 */
function getValorHoraForDate(
  history: ProgressaoHistoricoEntry[],
  dateYmd: string,
): number | null {
  const active = history.find((r) => r.dataYmd <= dateYmd && r.valorHora != null)
  return active?.valorHora ?? null
}

/**
 * Retorna a data de desligamento (YYYY-MM-DD) se existir uma progressão
 * com tipo DESLIGAMENTO no histórico, ou null caso contrário.
 */
function getDesligamentoDate(history: ProgressaoHistoricoEntry[]): string | null {
  const entry = history.find((r) => r.tipo === "DESLIGAMENTO")
  return entry?.dataYmd ?? null
}

/**
 * Para usuários desligados, retorna o valorHora (centavos) definido no
 * próprio registro de DESLIGAMENTO. Esse valor representa a taxa final
 * acordada e deve ser usado para TODOS os cálculos de investimento
 * independentemente da data do lançamento.
 * Retorna null se o registro de desligamento não possuir valorHora.
 */
function getValorHoraDesligamento(history: ProgressaoHistoricoEntry[]): number | null {
  const entry = history.find((r) => r.tipo === "DESLIGAMENTO" && r.valorHora != null)
  return entry?.valorHora ?? null
}

// ─── QA year-level totals ──────────────────────────────────────────────────────
// Computed by computeJiraKpis from @/features/qa/lib/jira-stats-kpis (shared module).
// priorityIsCritical and isBrokenTest are also imported from that module.

interface QaYearTotals {
  cenariosTestados: number
  cenariosErro: number
  jirasBroken: number
  criticos: number
}

// ─── AvatarStrip ──────────────────────────────────────────────────────────────

const AVATAR_STRIP_SIZE = 38

function AvatarStrip({
  membros,
  selectedUserIds,
  onToggle,
}: {
  membros: EquipeMembroLancamentos[]
  selectedUserIds: string[]
  onToggle: (userId: string) => void
}) {
  const hasSelection = selectedUserIds.length > 0
  return (
    <TooltipProvider delay={0} closeDelay={0}>
      <div
        className="flex w-full flex-wrap items-center justify-start gap-y-2 pl-2"
        role="toolbar"
        aria-label="Selecionar usuário para visualizar dados"
      >
        {membros.map((m, idx) => {
          const isSelected = selectedUserIds.includes(m.userId)
          const dimmed = hasSelection && !isSelected
          const isInactive = m.isInactive
          return (
            <Tooltip key={m.userId}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${m.name}${isInactive ? " (inativo)" : ""}${isSelected ? ", selecionado" : ""}`}
                    onClick={() => onToggle(m.userId)}
                    className={cn(
                      "relative rounded-full border-[3px] border-surface-card bg-surface-card shadow-sm transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 motion-reduce:transition-none",
                      isSelected
                        ? "z-20 border-brand-primary ring-2 ring-brand-primary/35"
                        : "z-10 hover:z-30 hover:ring-1 hover:ring-brand-primary/25",
                      dimmed && "opacity-40",
                    )}
                    style={{ marginLeft: idx === 0 ? 0 : -12 }}
                  />
                }
              >
                <UserAvatar name={m.name} photoPath={m.photoPath} size={AVATAR_STRIP_SIZE} inactive={isInactive} />
              </TooltipTrigger>
              <TooltipContent>
                {isInactive ? `${m.name} (inativo)` : m.name}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

// ─── SparklineChart ───────────────────────────────────────────────────────────

const SPARK_MONTHS      = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const SPARK_MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

const VARIANT_COLOR: Record<"brand" | "warning" | "success" | "info", string> = {
  brand:   "#5C9E8D",
  success: "#83B8A8",
  warning: "#CB8275",
  info:    "#5C7FA0",
}

function SparklineChart({
  data,
  variant,
  valueFormatter,
  hideValue,
}: {
  data: number[]
  variant: "brand" | "warning" | "success" | "info"
  valueFormatter?: (v: number) => string
  hideValue?: boolean
}) {
  const uid = React.useId().replace(/:/g, "")
  const gradientId = `spark-${uid}`
  const color = VARIANT_COLOR[variant]
  const chartData = data.map((v, i) => ({
    month: SPARK_MONTHS[i] ?? String(i + 1),
    monthFull: SPARK_MONTHS_FULL[i] ?? String(i + 1),
    v,
  }))
  return (
    <ResponsiveContainer width="100%" height={88}>
      <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={true}
          horizontal={false}
          stroke={color}
          strokeOpacity={0.12}
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={{ fontSize: 9, fill: "#8BAFC5" }}
          padding={{ left: 8, right: 8 }}
        />
        <RechartsTooltip
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const entry = payload[0]?.payload as { month: string; monthFull: string; v: number }
            return (
              <div className="rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs shadow-card">
                <p className="font-semibold text-text-primary">{entry.monthFull}</p>
                <p className="text-text-secondary">
                  {hideValue
                    ? <span className="tracking-widest text-text-disabled">••••</span>
                    : valueFormatter ? valueFormatter(entry.v) : String(entry.v)}
                </p>
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconVariant,
  sensitive,
  hidden,
  sparkData,
  sparkFormatter,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconVariant: "brand" | "warning" | "success" | "info"
  sensitive?: boolean
  hidden?: boolean
  sparkData?: number[]
  sparkFormatter?: (v: number) => string
}) {
  const iconColor = VARIANT_COLOR[iconVariant]
  const iconStyle: React.CSSProperties = {
    backgroundColor: `${iconColor}1a`,
    color: iconColor,
  }
  const showSpark = sparkData && sparkData.length > 0
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 select-none text-2xl font-bold text-text-primary">
            {sensitive && hidden
              ? <span className="tracking-widest text-text-disabled">••••</span>
              : value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
        </div>
        <div
          className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={iconStyle}
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
      {showSpark && (
        <div className="-mx-1 mt-3">
          <SparklineChart
            data={sparkData}
            variant={iconVariant}
            valueFormatter={sparkFormatter}
            hideValue={sensitive && hidden}
          />
        </div>
      )}
    </div>
  )
}

// ─── TagLineChart ─────────────────────────────────────────────────────────────

const BAR_PALETTE = [
  "#5C9E8D",
  "#5C7FA0",
  "#C9A870",
  "#CB8275",
  "#83B8A8",
  "#8BAFC5",
  "#9A7835",
  "#E8ADA3",
  "#3D7A6C",
  "#3D5E7A",
]

const LINE_MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

/**
 * Multi-line time series: X = selected months, Y = unique issue count,
 * one colored line per project (top 5, rest grouped as "Outros").
 */
function TagLineChart({
  title,
  items,
  activeMonths,
  ariaLabel,
  totalCount,
}: {
  title: string
  items: { project: string; count: number; countByMonth: number[] }[]
  activeMonths: number[]
  ariaLabel: string
  totalCount?: number
}) {
  const [activeKey, setActiveKey] = React.useState<string | null>(null)
  const sorted = [...items].sort((a, b) => b.count - a.count)
  const topItems = sorted.length <= 5 ? sorted : (() => {
    const top = sorted.slice(0, 5)
    const otherCountByMonth = sorted.slice(5).reduce<number[]>(
      (acc, item) => acc.map((v, i) => v + (item.countByMonth[i] ?? 0)),
      Array(12).fill(0) as number[],
    )
    const otherTotal = sorted.slice(5).reduce((s, item) => s + item.count, 0)
    return [...top, { project: "Outros", count: otherTotal, countByMonth: otherCountByMonth }]
  })()

  const chartData = activeMonths.map((m) => {
    const obj: Record<string, string | number> = {
      month: LINE_MONTHS_SHORT[m] ?? String(m + 1),
    }
    for (const item of topItems) {
      obj[item.project] = item.countByMonth[m] ?? 0
    }
    return obj
  })

  const colors = topItems.map((_, i) => BAR_PALETTE[i % BAR_PALETTE.length] as string)

  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="mb-4 text-sm font-semibold text-text-primary">
        {title}
        {totalCount != null && totalCount > 0 && (
          <span className="ml-1.5 font-normal text-text-secondary">({totalCount})</span>
        )}
      </p>
      {topItems.length === 0 ? (
        <p className="text-sm text-text-secondary">Sem dados no período.</p>
      ) : (
        <div role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#5C7FA0" }}
                interval={0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#8BAFC5" }}
                allowDecimals={false}
                width={28}
              />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs shadow-card">
                      <p className="mb-1 font-semibold text-text-primary">{label as string}</p>
                      {payload.map((p) => (
                        <p key={p.dataKey as string} style={{ color: p.color }} className="text-text-secondary">
                          {p.name}: {p.value as number} {(p.value as number) === 1 ? "jira" : "jiras"}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                verticalAlign="top"
                align="left"
                content={(props) => {
                  const payload = props.payload as Array<{ value: string; color: string; dataKey: string }> | undefined
                  if (!payload?.length) return null
                  return (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2">
                      {payload.map((entry) => {
                        const isActive = activeKey === null || activeKey === entry.dataKey
                        return (
                          <button
                            key={entry.dataKey}
                            type="button"
                            onClick={() => setActiveKey((prev) => prev === entry.dataKey ? null : entry.dataKey)}
                            className="flex cursor-pointer items-center gap-1.5 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                            style={{ opacity: isActive ? 1 : 0.35, fontSize: 14, color: "#475569" }}
                          >
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.value}
                          </button>
                        )
                      })}
                    </div>
                  )
                }}
              />
              {topItems.map((item, index) => (
                <Line
                  key={item.project}
                  type="monotone"
                  dataKey={item.project}
                  stroke={colors[index]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                  hide={activeKey !== null && activeKey !== item.project}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── TypeCard ─────────────────────────────────────────────────────────────────

const TYPE_CARD_TINT_HEX: Record<string, string> = {
  blue:    "#3b82f6",
  violet:  "#8b5cf6",
  warning: "#CB8275",
}

function TypeCard({
  label,
  count,
  totalIssues,
  pctDenominator,
  totalInvestimentoCentavos,
  timeSpentSeconds,
  hideValues,
  hideBadge,
  hideCostTime,
  tint,
  icon: Icon,
  iconVariant,
}: {
  label: string
  count: number
  totalIssues: number
  pctDenominator?: number
  totalInvestimentoCentavos: number
  timeSpentSeconds: number
  hideValues: boolean
  hideBadge?: boolean
  hideCostTime?: boolean
  tint?: "blue" | "violet" | "warning"
  icon?: React.ElementType
  iconVariant?: "brand" | "warning" | "success" | "info"
}) {
  const denomPct = pctDenominator ?? totalIssues
  const pct = denomPct > 0 ? Math.round((count / denomPct) * 100) : 0
  const costCentavos = totalIssues > 0
    ? Math.round((count / totalIssues) * totalInvestimentoCentavos)
    : 0
  const tintHex = tint ? TYPE_CARD_TINT_HEX[tint] : undefined
  const tintStyle: React.CSSProperties | undefined = tintHex ? { color: tintHex } : undefined
  const badgeStyle: React.CSSProperties | undefined = tintHex
    ? { backgroundColor: `${tintHex}1a`, color: tintHex }
    : undefined
  const iconColor = Icon && iconVariant ? VARIANT_COLOR[iconVariant] : undefined
  const iconStyle: React.CSSProperties | undefined = iconColor
    ? { backgroundColor: `${iconColor}1a`, color: iconColor }
    : undefined
  return (
    <div className="rounded-xl bg-surface-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-text-secondary" style={tintStyle}>{label}</p>
            {!hideBadge && (
              <span
                className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
                style={badgeStyle}
                aria-hidden
              >
                {hideValues ? "••" : `${pct}%`}
              </span>
            )}
          </div>
          <p className="mt-1 text-3xl font-bold text-text-primary tabular-nums">{count}</p>
          {!hideCostTime && (
            <div className="mt-1.5 flex items-center justify-between text-xs text-text-secondary">
              <span className="tabular-nums">
                {hideValues
                  ? <span className="tracking-widest text-text-disabled">••••</span>
                  : formatDurationAvg(timeSpentSeconds)}
              </span>
              <span className="tabular-nums">
                {hideValues
                  ? <span className="tracking-widest text-text-disabled">••••</span>
                  : formatBRL(costCentavos)}
              </span>
            </div>
          )}
        </div>
        {Icon && iconStyle && (
          <div
            className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={iconStyle}
          >
            <Icon className="size-5" aria-hidden />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── QA Year Table ─────────────────────────────────────────────────────────────

function QaYearTable({
  monthStats,
  hideValues,
  ano,
  activeMonths,
  quarterDedupeStats,
  periodTotalRow,
}: {
  monthStats: QaMonthStats[]
  hideValues: boolean
  ano: number
  activeMonths: number[]
  quarterDedupeStats: QaMonthStats[]
  periodTotalRow: QaMonthStats
}) {
  const activeMonthSet = new Set(activeMonths)
  const visibleQuarters = QUARTERS.map((q, qi) => ({ ...q, qi })).filter(q => q.months.some(m => activeMonthSet.has(m)))
  const today = new Date()
  const currentMonthIndex = ano === today.getFullYear() ? today.getMonth() : -1
  const inv = (v: number) =>
    hideValues ? <span className="tracking-widest text-text-disabled">••••</span> : formatBRL(v)

  const thBase = "px-3 py-3 text-xs font-semibold text-text-secondary"
  const TH = ({ children, center, group }: { children: React.ReactNode; center?: boolean; group?: "blue" }) => (
    <th className={cn(thBase, center ? "text-center" : "text-right", group === "blue" && "bg-[#EDF5F3]/80 dark:bg-[#0e2320]/60")}>
      {children}
    </th>
  )
  const tdCls = (base: string, group?: "blue") =>
    cn(base, group === "blue" && "bg-[#EDF5F3]/80 dark:bg-[#0e2320]/60")

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
              Período
            </th>
            <TH>Investimento</TH>
            <TH>Horas</TH>
            <TH center>Jiras</TH>
            <TH center group="blue">Cenários Testados</TH>
            <TH center group="blue">Cenários com Erro</TH>
            <TH center group="blue">Jiras de Retorno</TH>
          </tr>
        </thead>
        <tbody>
          {visibleQuarters.map((q) => {
            const visibleMonths = q.months.filter(m => activeMonthSet.has(m))
            const qStats = quarterDedupeStats[q.qi] ?? emptyQaMonthStats()
            return (
              <React.Fragment key={q.label}>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{q.label}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{inv(qStats.investimentoCentavos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{formatHHMM(qStats.totalSeconds)}</td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary">{qStats.totalIssues}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.cenariosTestados}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.cenariosErro}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.jirasBroken}</td>
                </tr>
                {visibleMonths.map((mi) => {
                  const ms = monthStats[mi]!
                  return (
                    <tr
                      key={mi}
                      className={cn(
                        "border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/50",
                        mi === currentMonthIndex && "[&_td]:!text-[#C9A870] [&_td]:font-semibold",
                      )}
                    >
                      <td className="px-4 py-2 pl-8 text-text-secondary">{MONTHS_PT[mi]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{inv(ms.investimentoCentavos)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{formatHHMM(ms.totalSeconds)}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-text-primary">{ms.totalIssues}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.cenariosTestados}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.cenariosErro}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.jirasBroken}</td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}

          <tr className="border-t-2 border-border-default bg-neutral-grey-50">
            <td className="px-4 py-2.5 font-bold text-text-primary">Total</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{inv(periodTotalRow.investimentoCentavos)}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{formatHHMM(periodTotalRow.totalSeconds)}</td>
            <td className="px-3 py-2.5 text-center font-bold tabular-nums text-text-primary">{periodTotalRow.totalIssues}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.cenariosTestados}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.cenariosErro}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.jirasBroken}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function QaDashboardClient({ membros, progressaoMap, brokenTestIssueTypeNames }: Props) {
  const currentYear = new Date().getFullYear()
  const [periodValue, setPeriodValue] = React.useState(() => defaultPeriodValue(currentYear))
  const { year: ano, activeMonths } = React.useMemo(
    () => parsePeriod(periodValue, currentYear),
    [periodValue, currentYear],
  )
  const periodOptions = React.useMemo(() => buildPeriodOptions(currentYear), [currentYear])
  const [loading, setLoading] = React.useState(false)
  const [hideValues, setHideValues] = React.useState(true)
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
  const [rawMemberEntries, setRawMemberEntries] = React.useState<Record<string, JiraEntry[]>>({})
  // Broken Test reporter stats per member per month — from JiraWorklogSyncMarker.
  // These are the authoritative source for jirasBroken and cenariosErro (Tipo B).
  const [rawMemberBtStats, setRawMemberBtStats] = React.useState<Record<string, Record<number, BtMonthStats>>>({})

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  // ── Visible members ────────────────────────────────────────────────────────
  // Um membro é exibido apenas se:
  //   1. Possui ao menos um lançamento no período selecionado (activeMonths), E
  //   2. Não foi desligado ANTES do início do período.
  // Antes de os dados carregarem, todos os membros são exibidos (skeleton state).
  const visibleMembros = React.useMemo(() => {
    const loaded = Object.keys(rawMemberEntries).length > 0
    if (!loaded) return membros
    const activeMonthSet = new Set(activeMonths)
    const firstActiveMonth = Math.min(...activeMonths)
    const firstDayOfPeriod = `${ano}-${pad(firstActiveMonth + 1)}-01`
    return membros.filter((m) => {
      const history = progressaoMap[m.userId] ?? []
      const desligamento = getDesligamentoDate(history)
      // Ocultar se desligado antes do início do período
      if (desligamento != null && desligamento < firstDayOfPeriod) return false
      // Verificação existente: tem ao menos um lançamento no período
      return (rawMemberEntries[m.userId] ?? []).some((e) => {
        const month = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
        return activeMonthSet.has(month)
      })
    })
  }, [rawMemberEntries, membros, activeMonths, progressaoMap, ano])

  // Active members: todos os visíveis quando sem seleção; filtrados por seleção caso contrário
  const activeMembers = React.useMemo(
    () =>
      selectedUserIds.length > 0
        ? visibleMembros.filter((m) => selectedUserIds.includes(m.userId))
        : visibleMembros,
    [visibleMembros, selectedUserIds],
  )

  const normalizedBrokenTypes = React.useMemo(
    () => brokenTestIssueTypeNames.map((t) => t.toLowerCase().trim()),
    [brokenTestIssueTypeNames],
  )

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { monthStats, totalUniqueIssues, yearTotals, distribByProject, quarterDedupeStats, periodTotalRow } = React.useMemo(() => {
    const empty: QaYearTotals = { cenariosTestados: 0, cenariosErro: 0, jirasBroken: 0, criticos: 0 }

    if (Object.keys(rawMemberEntries).length === 0) {
      return {
        monthStats: null,
        totalUniqueIssues: 0,
        yearTotals: empty,
        distribByProject: [] as { project: string; count: number; investimentoCentavos: number; countByMonth: number[] }[],
        quarterDedupeStats: QUARTERS.map(() => emptyQaMonthStats()),
        periodTotalRow: emptyQaMonthStats(),
      }
    }

    // Aggregate BT reporter stats across active members per month.
    // jirasBroken and cenariosErroSum come from JiraWorklogSyncMarker (reporter-based JQL),
    // matching the same calculation used in /api/jira/lancamentos. BT issues belong to the
    // month they were CREATED, so summing across months in a period has no double-count risk.
    const memberBtStatsSum: Record<number, { jirasBroken: number; cenariosErroSum: number }> = {}
    for (const m of activeMembers) {
      const btStats = rawMemberBtStats[m.userId] ?? {}
      for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
        const ms = btStats[monthIdx]
        if (ms) {
          const cur = memberBtStatsSum[monthIdx] ?? { jirasBroken: 0, cenariosErroSum: 0 }
          memberBtStatsSum[monthIdx] = {
            jirasBroken: cur.jirasBroken + ms.jirasBroken,
            cenariosErroSum: cur.cenariosErroSum + ms.cenariosErroSum,
          }
        }
      }
    }

    const combined: QaMonthStats[] = Array.from({ length: 12 }, emptyQaMonthStats)
    const allEntries: JiraEntry[] = []
    const projectMonthInvestmentMap = new Map<string, number[]>()

    // Pass 1 — per-member: accumulate hours and investment.
    // Lançamentos após a data de desligamento são ignorados (regra de negócio).
    // Para usuários desligados (inativos): o valorHora é sempre o do registro de
    // DESLIGAMENTO (taxa final acordada), independentemente da data do lançamento.
    // Para usuários ativos: getValorHoraForDate resolve a taxa vigente por lançamento.
    for (const m of activeMembers) {
      const entries = rawMemberEntries[m.userId] ?? []
      const history = progressaoMap[m.userId] ?? []
      const desligamento = getDesligamentoDate(history)
      // Usuário inativo: pré-resolve a taxa do desligamento (ou null → fallback por data)
      const valorHoraFixo = desligamento != null ? getValorHoraDesligamento(history) : null
      for (const e of entries) {
        const entryDate = e.started.slice(0, 10)
        // Regra de desligamento: ignorar lançamentos após a data de desligamento
        if (desligamento != null && entryDate > desligamento) continue
        allEntries.push(e)
        const month = new Date(`${entryDate}T12:00:00`).getMonth()
        if (month < 0 || month > 11) continue
        combined[month]!.totalSeconds += e.timeSpentSeconds
        // Inativo: usa a taxa do desligamento; ativo: resolve pela data do lançamento
        const valorHora = valorHoraFixo ?? getValorHoraForDate(history, entryDate)
        if (valorHora != null) {
          const cost = Math.round((e.timeSpentSeconds / 3600) * valorHora)
          combined[month]!.investimentoCentavos += cost
          const project = e.projectName?.trim() || "Sem projeto"
          if (!projectMonthInvestmentMap.has(project)) projectMonthInvestmentMap.set(project, Array(12).fill(0) as number[])
          projectMonthInvestmentMap.get(project)![month] = (projectMonthInvestmentMap.get(project)![month] ?? 0) + cost
        }
      }
    }

    // Build projectMonthIssueCountMap: unique issues per project per month
    const projectMonthIssueCountMap = new Map<string, number[]>()
    const seenIssueProjectMonth = new Set<string>()
    for (const e of allEntries) {
      const month = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      if (month < 0 || month > 11) continue
      const project = e.projectName?.trim() || "Sem projeto"
      const key = `${e.issueKey}\x00${project}\x00${month}`
      if (seenIssueProjectMonth.has(key)) continue
      seenIssueProjectMonth.add(key)
      if (!projectMonthIssueCountMap.has(project)) projectMonthIssueCountMap.set(project, Array(12).fill(0) as number[])
      projectMonthIssueCountMap.get(project)![month]!++
    }

    // Pass 2 — global: count unique issues per month.
    // An issue is counted in EVERY month it has a worklog in (not just its first month),
    // so combined[m].totalIssues matches what lançamentos shows for each month.

    // NOTE: jirasBroken and cenariosErro (Tipo B) are NO LONGER computed from worklog entries.
    // They come from memberBtStatsSum (reporter-based JQL, matching /api/jira/lancamentos).
    // Only Tipo A cenariosErro (from qtdCenariosErro field on worklogged issues) and
    // cenariosTestados (from qtdCenariosQA field) still use worklog entries.

    type QaCB = {
      all: Set<string>
      criticoIssues: Set<string>
      cenariosQAByIssue: Map<string, number>
      cenariosErroByIssue: Map<string, number>
    }
    const buckets: QaCB[] = Array.from({ length: 12 }, () => ({
      all: new Set(),
      criticoIssues: new Set(),
      cenariosQAByIssue: new Map(),
      cenariosErroByIssue: new Map(),
    }))

    for (const e of allEntries) {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      if (m < 0 || m > 11) continue
      const cb = buckets[m]!
      cb.all.add(e.issueKey)
      if (priorityIsCritical(e.priority)) cb.criticoIssues.add(e.issueKey)
      if (e.qtdCenariosQA > 0) {
        cb.cenariosQAByIssue.set(
          e.issueKey,
          Math.max(cb.cenariosQAByIssue.get(e.issueKey) ?? 0, e.qtdCenariosQA),
        )
      }
      if (e.qtdCenariosErro > 0) {
        // Tipo A: issues where qtdCenariosErro is filled by the QA directly
        cb.cenariosErroByIssue.set(
          e.issueKey,
          Math.max(cb.cenariosErroByIssue.get(e.issueKey) ?? 0, e.qtdCenariosErro),
        )
      }
    }

    for (let i = 0; i < 12; i++) {
      const cb = buckets[i]!
      combined[i]!.totalIssues = cb.all.size
      // jirasBroken: from reporter-based JQL (authoritative, matches Lançamentos screen)
      combined[i]!.jirasBroken = memberBtStatsSum[i]?.jirasBroken ?? 0
      combined[i]!.criticos = cb.criticoIssues.size
      combined[i]!.cenariosTestados = Array.from(cb.cenariosQAByIssue.values()).reduce((s, v) => s + v, 0)
      // Cenários com erro: Tipo A (qtdCenariosErro from entries) + Tipo B (BT reporter stats)
      const cenariosErroTypeA = Array.from(cb.cenariosErroByIssue.values()).reduce((s, v) => s + v, 0)
      combined[i]!.cenariosErro = cenariosErroTypeA + (memberBtStatsSum[i]?.cenariosErroSum ?? 0)
    }

    const dedupeQaStats = (monthIndices: number[]): QaMonthStats => {
      const allSet = new Set<string>()
      const critSet = new Set<string>()
      const cenariosQA = new Map<string, number>()
      const cenariosErro = new Map<string, number>()
      for (const m of monthIndices) {
        const cb = buckets[m]!
        for (const k of cb.all) allSet.add(k)
        for (const k of cb.criticoIssues) critSet.add(k)
        for (const [k, v] of cb.cenariosQAByIssue) cenariosQA.set(k, Math.max(cenariosQA.get(k) ?? 0, v))
        for (const [k, v] of cb.cenariosErroByIssue) cenariosErro.set(k, Math.max(cenariosErro.get(k) ?? 0, v))
      }
      // Tipo A: deduped across months by issueKey
      const cenariosErroTypeA = Array.from(cenariosErro.values()).reduce((s, v) => s + v, 0)
      // Tipo B: sum across months — BT issues are creation-date bucketed, no cross-month double-count
      const cenariosErroTypeB = monthIndices.reduce((s, m) => s + (memberBtStatsSum[m]?.cenariosErroSum ?? 0), 0)
      const jirasBroken = monthIndices.reduce((s, m) => s + (memberBtStatsSum[m]?.jirasBroken ?? 0), 0)
      return {
        totalSeconds: monthIndices.reduce((s, m) => s + (combined[m]?.totalSeconds ?? 0), 0),
        investimentoCentavos: monthIndices.reduce((s, m) => s + (combined[m]?.investimentoCentavos ?? 0), 0),
        totalIssues: allSet.size,
        cenariosTestados: Array.from(cenariosQA.values()).reduce((s, v) => s + v, 0),
        cenariosErro: cenariosErroTypeA + cenariosErroTypeB,
        jirasBroken,
        criticos: critSet.size,
      }
    }

    const quarterDedupeStats: QaMonthStats[] = QUARTERS.map(q => dedupeQaStats(q.months))
    const periodTotalRow = dedupeQaStats(activeMonths)

    // Entries from active months only (for yearTotals and distribByProject)
    const anchoredEntries = allEntries.filter(e => {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      return activeMonths.includes(m)
    })

    // yTotals derives from periodTotalRow (already deduplicated for the selected period).
    // jirasBroken and cenariosErro come from reporter-based BT stats (memberBtStatsSum),
    // matching the /api/jira/lancamentos calculation — no worklog-based approximation.
    const yTotals: QaYearTotals = {
      cenariosTestados: periodTotalRow.cenariosTestados,
      cenariosErro:     periodTotalRow.cenariosErro,
      jirasBroken:      periodTotalRow.jirasBroken,
      criticos:         periodTotalRow.criticos,
    }

    const periodProjectInvestment = (project: string): number =>
      activeMonths.reduce((s, m) => s + (projectMonthInvestmentMap.get(project)?.[m] ?? 0), 0)

    const projectDistribMap = new Map<string, Set<string>>()
    for (const e of anchoredEntries) {
      const project = e.projectName?.trim() || "Sem projeto"
      if (!projectDistribMap.has(project)) projectDistribMap.set(project, new Set())
      projectDistribMap.get(project)!.add(e.issueKey)
    }

    const distribByProject = [...projectDistribMap.entries()]
      .map(([project, keys]) => ({
        project,
        count: keys.size,
        investimentoCentavos: periodProjectInvestment(project),
        countByMonth: projectMonthIssueCountMap.get(project) ?? (Array(12).fill(0) as number[]),
      }))
      .sort((a, b) => b.count - a.count)

    return {
      monthStats: combined,
      totalUniqueIssues: periodTotalRow.totalIssues,
      yearTotals: yTotals,
      distribByProject,
      quarterDedupeStats,
      periodTotalRow,
    }
  }, [rawMemberEntries, rawMemberBtStats, activeMembers, progressaoMap, ano, activeMonths])

  // Limpar seleções que não são mais visíveis (ex.: mudança de ano ou desligamento)
  React.useEffect(() => {
    const visibleIds = new Set(visibleMembros.map((m) => m.userId))
    setSelectedUserIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [visibleMembros])

  // ── Derived totals for metric cards ───────────────────────────────────────
  const totalAnual = React.useMemo(
    () => activeMonths.reduce(
      (acc, m) => sumQaStats(acc, (monthStats ?? [])[m] ?? emptyQaMonthStats()),
      emptyQaMonthStats(),
    ),
    [monthStats, activeMonths],
  )

  const avgValorHora = React.useMemo(() => {
    const lastActiveMonth = activeMonths[activeMonths.length - 1] ?? 11
    const refMonth = ano === new Date().getFullYear()
      ? Math.min(new Date().getMonth(), lastActiveMonth)
      : lastActiveMonth
    const rates = activeMembers
      .map((m) => getValorHoraForMonth(progressaoMap[m.userId] ?? [], ano, refMonth))
      .filter((v): v is number => v != null)
    return rates.length > 0 ? rates.reduce((s, v) => s + v, 0) / rates.length : null
  }, [activeMembers, progressaoMap, ano, activeMonths])

  const avgSecondsPerIssue = totalUniqueIssues > 0
    ? Math.round(totalAnual.totalSeconds / totalUniqueIssues)
    : 0
  const avgInvestimentoCentavos =
    avgValorHora != null ? Math.round(avgValorHora * (avgSecondsPerIssue / 3600)) : 0

  const avgSecondsPerCenario = yearTotals.cenariosTestados > 0
    ? Math.round(totalAnual.totalSeconds / yearTotals.cenariosTestados)
    : 0
  const avgCentavosPerCenario = yearTotals.cenariosTestados > 0
    ? Math.round(totalAnual.investimentoCentavos / yearTotals.cenariosTestados)
    : 0

  // ── Sparklines ────────────────────────────────────────────────────────────
  const sparkJiras    = activeMonths.map(m => (monthStats ?? [])[m]?.totalIssues ?? 0)
  const sparkCriticos = activeMonths.map(m => (monthStats ?? [])[m]?.criticos ?? 0)
  const sparkTempo    = activeMonths.map(m => {
    const ms = (monthStats ?? [])[m]
    return ms && ms.totalIssues > 0 ? Math.round(ms.totalSeconds / ms.totalIssues) : 0
  })
  const sparkValor    = activeMonths.map(m => {
    const ms = (monthStats ?? [])[m]
    return ms && ms.totalIssues > 0 && avgValorHora != null
      ? Math.round(avgValorHora * (ms.totalSeconds / ms.totalIssues / 3600))
      : 0
  })

  // ── Fetch all members on year change ─────────────────────────────────────
  const fetchAll = React.useCallback(
    async (year: number, force = false) => {
      setRawMemberEntries({})
      setRawMemberBtStats({})
      setLoading(true)
      try {
        if (membros.length === 0) {
          setRawMemberEntries({})
          setRawMemberBtStats({})
          return
        }
        const results = await Promise.all(
          membros.map(async (m) => {
            try {
              const { entries, btStatsByMonth } = await getUxWorklogsForYear(m.userId, year, force)
              return [m.userId, entries, btStatsByMonth] as const
            } catch {
              return [m.userId, [] as JiraEntry[], {} as Record<number, BtMonthStats>] as const
            }
          }),
        )
        setRawMemberEntries(Object.fromEntries(results.map(([id, entries]) => [id, entries])))
        setRawMemberBtStats(Object.fromEntries(results.map(([id, , btStats]) => [id, btStats])))
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-w-0 space-y-6">
      {/* Avatar strip + year selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {visibleMembros.length > 0 && (
            <AvatarStrip
              membros={visibleMembros}
              selectedUserIds={selectedUserIds}
              onToggle={toggleUser}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={periodValue}
            onValueChange={(v) => { if (v) setPeriodValue(v) }}
          >
            <SelectTrigger
              className="w-52"
              aria-label="Selecionar período"
            >
              <SelectValue>
                {periodOptions.find(o => o.value === periodValue)?.label ?? periodValue}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {periodOptions.map((opt, idx) => {
                const prevOpt = periodOptions[idx - 1]
                const showSep = idx > 0 && prevOpt && prevOpt.group !== opt.group
                return (
                  <React.Fragment key={opt.value}>
                    {showSep && <hr className="my-1 border-border-default/40" />}
                    <SelectItem value={opt.value}>{opt.label}</SelectItem>
                  </React.Fragment>
                )
              })}
            </SelectPopup>
          </Select>
          <button
            type="button"
            aria-label="Sincronizar dados"
            disabled={loading}
            onClick={() => void fetchAll(ano, true)}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={hideValues ? "Exibir valores monetários" : "Ocultar valores monetários"}
            onClick={() => setHideValues((v) => !v)}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {hideValues ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
      </div>

      {/* Metric cards — linha 1 (4 cards com sparkline) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Tempo médio 🠆 Jira"
          value={loading ? "—" : formatDurationAvg(avgSecondsPerIssue)}
          icon={Clock}
          iconVariant="brand"
          sparkData={loading ? undefined : sparkTempo}
          sparkFormatter={formatDurationAvg}
        />
        <MetricCard
          label="Custo médio 🠆 Jira"
          value={loading ? "—" : formatBRL(avgInvestimentoCentavos)}
          icon={DollarSign}
          iconVariant="success"
          sensitive
          hidden={hideValues}
          sparkData={loading ? undefined : sparkValor}
          sparkFormatter={formatBRL}
        />
        <MetricCard
          label="Total de Jiras"
          value={loading ? "—" : String(totalUniqueIssues)}
          icon={BarChart2}
          iconVariant="info"
          sparkData={loading ? undefined : sparkJiras}
          sparkFormatter={(v) => `${v} jira${v !== 1 ? "s" : ""}`}
        />
        <MetricCard
          label="Jiras Críticos"
          value={loading ? "—" : String(yearTotals.criticos)}
          icon={Flame}
          iconVariant="warning"
          sparkData={loading ? undefined : sparkCriticos}
          sparkFormatter={(v) => `${v} crítico${v !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Type cards — Cenários Testados | Tempo médio → Cenário | Custo médio → Cenário | Cenários com Erro | Jiras de Retorno (Broken) */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <TypeCard
            label="Cenários Testados"
            count={yearTotals.cenariosTestados}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            hideBadge
            hideCostTime
            tint="blue"
            icon={CheckSquare2}
            iconVariant="brand"
          />
          <MetricCard
            label="Tempo médio 🠆 Cenário"
            value={formatDurationAvg(avgSecondsPerCenario)}
            icon={Clock}
            iconVariant="brand"
          />
          <MetricCard
            label="Custo médio 🠆 Cenário"
            value={formatBRL(avgCentavosPerCenario)}
            icon={DollarSign}
            iconVariant="success"
            sensitive
            hidden={hideValues}
          />
          <TypeCard
            label="Cenários com Erro"
            count={yearTotals.cenariosErro}
            totalIssues={totalUniqueIssues}
            pctDenominator={yearTotals.cenariosTestados}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            hideCostTime
            tint="warning"
          />
          <TypeCard
            label="Jiras de Retorno (Broken)"
            count={yearTotals.jirasBroken}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            hideCostTime
            tint="warning"
          />
        </div>
      )}

      {/* Jiras por Projeto */}
      {!loading && (
        <TagLineChart
          title="Testes por Projeto"
          items={distribByProject}
          activeMonths={activeMonths}
          totalCount={distribByProject.reduce((s, i) => s + i.count, 0)}
          ariaLabel="Distribuição de testes por projeto"
        />
      )}

      {/* Yearly table */}
      {loading || monthStats === null ? (
        <SectionSpinner minHeight="min-h-[300px]" />
      ) : (
        <QaYearTable monthStats={monthStats} hideValues={hideValues} ano={ano} activeMonths={activeMonths} quarterDedupeStats={quarterDedupeStats} periodTotalRow={periodTotalRow} />
      )}
    </div>
  )
}
