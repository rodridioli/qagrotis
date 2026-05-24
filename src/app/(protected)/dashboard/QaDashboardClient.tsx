"use client"

import * as React from "react"
import { AlertTriangle, BarChart2, CheckSquare2, Clock, Eye, EyeOff, Flame, RefreshCw, TrendingUp } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, Cell, YAxis, ResponsiveContainer, XAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts"
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
import { getUxWorklogsForYear } from "@/features/qa/actions/jira-worklog-cache"
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
  const prevYear = currentYear - 1
  return [
    { value: `Q1-${currentYear}`, label: `1° Trimestre / ${currentYear}`, group: "q" as const },
    { value: `Q2-${currentYear}`, label: `2° Trimestre / ${currentYear}`, group: "q" as const },
    { value: `Q3-${currentYear}`, label: `3° Trimestre / ${currentYear}`, group: "q" as const },
    { value: `Q4-${currentYear}`, label: `4° Trimestre / ${currentYear}`, group: "q" as const },
    { value: `H1-${currentYear}`, label: `1° Semestre / ${currentYear}`, group: "h" as const },
    { value: `H2-${currentYear}`, label: `2° Semestre / ${currentYear}`, group: "h" as const },
    { value: `FULL-${currentYear}`, label: String(currentYear), group: "y" as const },
    { value: `FULL-${prevYear}`, label: String(prevYear), group: "y" as const },
  ]
}

function defaultPeriodValue(currentYear: number): string {
  const month = new Date().getMonth()
  const q = Math.floor(month / 3) + 1
  return `Q${q}-${currentYear}`
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

// ─── QA year-level totals ──────────────────────────────────────────────────────

interface QaYearTotals {
  cenariosTestados: number
  cenariosErro: number
  jirasBroken: number
  criticos: number
}

// ─── Priority helpers (mirrors IndividualLancamentosSection logic) ─────────────

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

/**
 * Agrega entries QA para os cards de ano.
 * - cenariosTestados: SUM(qtdCenariosQA) por issue única (pega o máximo por issue)
 * - cenariosErro:     SUM de max(qtdCenariosErro) por issue; fallback para qtdCenariosQA em Broken Tests sem qtdCenariosErro (Tipo B)
 * - jirasBroken:      count de issues únicas cujo issueType ∈ brokenTestIssueTypeNames
 * - criticos:         count de issues únicas com prioridade crítica
 */
function aggregateQaYearTotals(
  entries: JiraEntry[],
  normalizedBrokenTypes: string[],
): QaYearTotals {
  const cenariosQAByIssue = new Map<string, number>()
  const cenariosErroByIssue = new Map<string, number>()
  const brokenTestQAByIssue = new Map<string, number>()
  const brokenIssues = new Set<string>()
  const criticoIssues = new Set<string>()

  const isBrokenTest = (e: JiraEntry) => {
    const t = (e.issueType ?? "").toLowerCase().trim()
    return normalizedBrokenTypes.length > 0
      ? normalizedBrokenTypes.some((n) => t === n)
      : t.includes("broken")
  }

  for (const e of entries) {
    if (e.qtdCenariosQA > 0) {
      cenariosQAByIssue.set(
        e.issueKey,
        Math.max(cenariosQAByIssue.get(e.issueKey) ?? 0, e.qtdCenariosQA),
      )
    }
    // Tipo A: qtdCenariosErro direto
    if (e.qtdCenariosErro > 0) {
      cenariosErroByIssue.set(
        e.issueKey,
        Math.max(cenariosErroByIssue.get(e.issueKey) ?? 0, e.qtdCenariosErro),
      )
    }
    // Tipo B: Broken Test sem qtdCenariosErro → accumulate qtdCenariosQA for fallback
    if (isBrokenTest(e) && e.qtdCenariosQA > 0) {
      brokenTestQAByIssue.set(
        e.issueKey,
        Math.max(brokenTestQAByIssue.get(e.issueKey) ?? 0, e.qtdCenariosQA),
      )
    }
    if (isBrokenTest(e)) brokenIssues.add(e.issueKey)
    if (priorityIsCritical(e.priority)) criticoIssues.add(e.issueKey)
  }

  const cenariosTestados = Array.from(cenariosQAByIssue.values()).reduce((s, v) => s + v, 0)

  // Cenários com erro: Tipo A + Tipo B fallback (only for issues without Tipo A)
  let cenariosErro = Array.from(cenariosErroByIssue.values()).reduce((s, v) => s + v, 0)
  for (const [key, v] of brokenTestQAByIssue.entries()) {
    if (!cenariosErroByIssue.has(key)) {
      cenariosErro += v
    }
  }

  return {
    cenariosTestados,
    cenariosErro,
    jirasBroken: brokenIssues.size,
    criticos: criticoIssues.size,
  }
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

// ─── TagBarChart ──────────────────────────────────────────────────────────────

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

function TagBarChart({
  title,
  items,
  ariaLabel,
  hideValues,
}: {
  title: string
  items: { tag: string; count: number; investimentoCentavos: number }[]
  ariaLabel: string
  hideValues?: boolean
}) {
  const chartHeight = Math.max(300, items.length * 28)
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="mb-4 text-sm font-semibold text-text-primary">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Sem dados no período.</p>
      ) : (
        <div role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={items} margin={{ top: 4, right: 8, bottom: 40, left: 8 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="tag"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#5C7FA0" }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={48}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#8BAFC5" }}
                allowDecimals={false}
                width={28}
              />
              <RechartsTooltip
                cursor={{ fill: `${BAR_PALETTE[0]}14` }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as { tag: string; count: number; investimentoCentavos: number }
                  return (
                    <div className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs shadow-card">
                      <p className="mb-1 font-semibold text-text-primary">{d.tag}</p>
                      <p className="text-text-secondary">{d.count} {d.count === 1 ? "jira" : "jiras"}</p>
                      {d.investimentoCentavos > 0 && (
                        <p className="text-text-secondary">
                          {hideValues
                            ? <span className="tracking-widest text-text-disabled">••••</span>
                            : formatBRL(d.investimentoCentavos)}
                        </p>
                      )}
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {items.map((_, index) => (
                  <Cell key={index} fill={BAR_PALETTE[index % BAR_PALETTE.length]} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
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
  tint,
}: {
  label: string
  count: number
  totalIssues: number
  pctDenominator?: number
  totalInvestimentoCentavos: number
  timeSpentSeconds: number
  hideValues: boolean
  tint?: "blue" | "violet" | "warning"
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
  return (
    <div className="rounded-xl bg-surface-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary" style={tintStyle}>{label}</p>
        <span
          className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
          style={badgeStyle}
          aria-hidden
        >
          {hideValues ? "••" : `${pct}%`}
        </span>
      </div>
      <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{count}</p>
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
    </div>
  )
}

// ─── QA Year Table ─────────────────────────────────────────────────────────────

function QaYearTable({
  monthStats,
  hideValues,
  ano,
  activeMonths,
}: {
  monthStats: QaMonthStats[]
  hideValues: boolean
  ano: number
  activeMonths: number[]
}) {
  const activeMonthSet = new Set(activeMonths)
  const visibleQuarters = QUARTERS.filter(q => q.months.some(m => activeMonthSet.has(m)))
  const totalAnual = activeMonths.reduce(
    (acc, m) => sumQaStats(acc, monthStats[m] ?? emptyQaMonthStats()),
    emptyQaMonthStats(),
  )
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
            const qStats = visibleMonths.reduce(
              (acc, mi) => sumQaStats(acc, monthStats[mi]!),
              emptyQaMonthStats(),
            )
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
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{inv(totalAnual.investimentoCentavos)}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{formatHHMM(totalAnual.totalSeconds)}</td>
            <td className="px-3 py-2.5 text-center font-bold tabular-nums text-text-primary">{totalAnual.totalIssues}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{totalAnual.cenariosTestados}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{totalAnual.cenariosErro}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{totalAnual.jirasBroken}</td>
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

  const activeMembers = React.useMemo(
    () =>
      selectedUserIds.length > 0
        ? membros.filter((m) => selectedUserIds.includes(m.userId))
        : membros,
    [membros, selectedUserIds],
  )

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const normalizedBrokenTypes = React.useMemo(
    () => brokenTestIssueTypeNames.map((t) => t.toLowerCase().trim()),
    [brokenTestIssueTypeNames],
  )

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { monthStats, totalUniqueIssues, yearTotals, distribByTag } = React.useMemo(() => {
    const empty: QaYearTotals = { cenariosTestados: 0, cenariosErro: 0, jirasBroken: 0, criticos: 0 }

    if (Object.keys(rawMemberEntries).length === 0) {
      return {
        monthStats: null,
        totalUniqueIssues: 0,
        yearTotals: empty,
        distribByTag: [] as { tag: string; count: number; investimentoCentavos: number }[],
      }
    }

    const combined: QaMonthStats[] = Array.from({ length: 12 }, emptyQaMonthStats)
    const allEntries: JiraEntry[] = []
    const tagMonthInvestmentMap = new Map<string, number[]>()

    // Pass 1 — per-member: accumulate hours and investment
    for (const m of activeMembers) {
      const entries = rawMemberEntries[m.userId] ?? []
      allEntries.push(...entries)
      const history = progressaoMap[m.userId] ?? []
      for (const e of entries) {
        const month = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
        if (month < 0 || month > 11) continue
        combined[month]!.totalSeconds += e.timeSpentSeconds
        const valorHora = getValorHoraForMonth(history, ano, month)
        if (valorHora != null) {
          const cost = Math.round((e.timeSpentSeconds / 3600) * valorHora)
          combined[month]!.investimentoCentavos += cost
          const tag = e.tag?.trim() || "Sem tag"
          if (!tagMonthInvestmentMap.has(tag)) tagMonthInvestmentMap.set(tag, Array(12).fill(0) as number[])
          tagMonthInvestmentMap.get(tag)![month] = (tagMonthInvestmentMap.get(tag)![month] ?? 0) + cost
        }
      }
    }

    // Pass 2 — global: count issues per month with first-month anchor.
    // Each issue is counted in exactly ONE month (the month of its earliest worklog),
    // so sum(combined[i].totalIssues) === totalUniqueIssues (no double-counting).
    {
      // Build first-month anchor: minimum month index across all worklogs per issue.
      const issueFirstMonth = new Map<string, number>()
      for (const e of allEntries) {
        const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
        if (m < 0 || m > 11) continue
        const cur = issueFirstMonth.get(e.issueKey)
        if (cur === undefined || m < cur) issueFirstMonth.set(e.issueKey, m)
      }

      const isBrokenTestEntry = (e: JiraEntry) => {
        const t = (e.issueType ?? "").toLowerCase().trim()
        return normalizedBrokenTypes.length > 0
          ? normalizedBrokenTypes.some((n) => t === n)
          : t.includes("broken")
      }

      type CB = {
        all: Set<string>
        brokenIssues: Set<string>
        criticoIssues: Set<string>
        cenariosQAByIssue: Map<string, number>
        cenariosErroByIssue: Map<string, number>
        brokenTestQAByIssue: Map<string, number>
      }
      const buckets: CB[] = Array.from({ length: 12 }, () => ({
        all: new Set(),
        brokenIssues: new Set(),
        criticoIssues: new Set(),
        cenariosQAByIssue: new Map(),
        cenariosErroByIssue: new Map(),
        brokenTestQAByIssue: new Map(),
      }))

      for (const e of allEntries) {
        const firstMonth = issueFirstMonth.get(e.issueKey)
        if (firstMonth === undefined) continue
        const cb = buckets[firstMonth]!
        cb.all.add(e.issueKey)
        if (isBrokenTestEntry(e)) cb.brokenIssues.add(e.issueKey)
        if (priorityIsCritical(e.priority)) cb.criticoIssues.add(e.issueKey)
        if (e.qtdCenariosQA > 0) {
          cb.cenariosQAByIssue.set(
            e.issueKey,
            Math.max(cb.cenariosQAByIssue.get(e.issueKey) ?? 0, e.qtdCenariosQA),
          )
        }
        if (e.qtdCenariosErro > 0) {
          cb.cenariosErroByIssue.set(
            e.issueKey,
            Math.max(cb.cenariosErroByIssue.get(e.issueKey) ?? 0, e.qtdCenariosErro),
          )
        }
        // Tipo B: Broken Test sem qtdCenariosErro → accumulate qtdCenariosQA for fallback
        if (isBrokenTestEntry(e) && e.qtdCenariosQA > 0) {
          cb.brokenTestQAByIssue.set(
            e.issueKey,
            Math.max(cb.brokenTestQAByIssue.get(e.issueKey) ?? 0, e.qtdCenariosQA),
          )
        }
      }

      for (let i = 0; i < 12; i++) {
        const cb = buckets[i]!
        combined[i]!.totalIssues = cb.all.size
        combined[i]!.jirasBroken = cb.brokenIssues.size
        combined[i]!.criticos = cb.criticoIssues.size
        combined[i]!.cenariosTestados = Array.from(cb.cenariosQAByIssue.values()).reduce((s, v) => s + v, 0)
        // Cenários com erro: Tipo A + Tipo B fallback
        let cenariosErroMonth = Array.from(cb.cenariosErroByIssue.values()).reduce((s, v) => s + v, 0)
        for (const [key, v] of cb.brokenTestQAByIssue.entries()) {
          if (!cb.cenariosErroByIssue.has(key)) {
            cenariosErroMonth += v
          }
        }
        combined[i]!.cenariosErro = cenariosErroMonth
      }
    }

    const activeMonthSet = new Set(activeMonths)
    const periodEntries = allEntries.filter(e => {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      return activeMonthSet.has(m)
    })

    const yTotals = aggregateQaYearTotals(periodEntries, normalizedBrokenTypes)

    const periodTagInvestment = (tag: string): number =>
      activeMonths.reduce((s, m) => s + (tagMonthInvestmentMap.get(tag)?.[m] ?? 0), 0)

    const tagDistribMap = new Map<string, Set<string>>()
    for (const e of periodEntries) {
      const tag = e.tag?.trim() || "Sem tag"
      if (!tagDistribMap.has(tag)) tagDistribMap.set(tag, new Set())
      tagDistribMap.get(tag)!.add(e.issueKey)
    }

    const distribByTag = [...tagDistribMap.entries()]
      .map(([tag, keys]) => ({ tag, count: keys.size, investimentoCentavos: periodTagInvestment(tag) }))
      .sort((a, b) => b.count - a.count)

    return {
      monthStats: combined,
      totalUniqueIssues: new Set(periodEntries.map((e) => e.issueKey)).size,
      yearTotals: yTotals,
      distribByTag,
    }
  }, [rawMemberEntries, activeMembers, progressaoMap, ano, activeMonths, normalizedBrokenTypes])

  // ── Visible members: only those with worklogs in the selected year ─────────
  const visibleMembros = React.useMemo(() => {
    const loaded = Object.keys(rawMemberEntries).length > 0
    if (!loaded) return membros
    return membros.filter((m) => (rawMemberEntries[m.userId]?.length ?? 0) > 0)
  }, [rawMemberEntries, membros])

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
      setLoading(true)
      try {
        if (membros.length === 0) {
          setRawMemberEntries({})
          return
        }
        const results = await Promise.all(
          membros.map(async (m) => {
            try {
              const { entries } = await getUxWorklogsForYear(m.userId, year, force)
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
          label="Tempo médio 🠆 Atividade"
          value={loading ? "—" : formatDurationAvg(avgSecondsPerIssue)}
          icon={Clock}
          iconVariant="brand"
          sparkData={loading ? undefined : sparkTempo}
          sparkFormatter={formatDurationAvg}
        />
        <MetricCard
          label="Valor médio 🠆 Atividade"
          value={loading ? "—" : formatBRL(avgInvestimentoCentavos)}
          icon={TrendingUp}
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

      {/* Type cards — Cenários Testados | Cenários com Erro | Jiras de Retorno (Broken) */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <TypeCard
            label="Cenários Testados"
            count={yearTotals.cenariosTestados}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            tint="blue"
          />
          <TypeCard
            label="Cenários com Erro"
            count={yearTotals.cenariosErro}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            tint="blue"
          />
          <TypeCard
            label="Jiras de Retorno (Broken)"
            count={yearTotals.jirasBroken}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            tint="warning"
          />
        </div>
      )}

      {/* Testes por Produto */}
      {!loading && (
        <TagBarChart
          title="Testes por Produto"
          items={distribByTag}
          ariaLabel="Distribuição de testes por produto"
          hideValues={hideValues}
        />
      )}

      {/* Yearly table */}
      {loading || monthStats === null ? (
        <SectionSpinner minHeight="min-h-[300px]" />
      ) : (
        <QaYearTable monthStats={monthStats} hideValues={hideValues} ano={ano} activeMonths={activeMonths} />
      )}
    </div>
  )
}
