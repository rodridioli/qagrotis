"use client"

import * as React from "react"
import { AlertTriangle, BarChart2, Clock, DollarSign, Eye, EyeOff, Info, RefreshCw } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, Cell, LineChart, Line, YAxis, ResponsiveContainer, XAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Legend } from "recharts"
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
import { getUxWorklogsForYear, getApprovalIssuesByTag } from "@/features/qa/actions/jira-worklog-cache"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { ProgressaoHistoricoEntry } from "@/features/individual/actions/individual-progressao"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  membros: EquipeMembroLancamentos[]
  /** Histórico completo de progressão por userId, ordenado por data DESC. */
  progressaoMap: Record<string, ProgressaoHistoricoEntry[]>
  /** Issues em aprovação com assignee — consultadas ao vivo via JQL, agrupadas no cliente após filtro de membro. */
  approvalIssues: { tag: string; assigneeAccountId: string | null }[]
  /** userId → Jira accountId, resolvido por e-mail no servidor. Garante filtragem correta mesmo para membros sem worklogs. */
  memberJiraIds: Record<string, string>
}

interface JiraEntry {
  issueKey: string
  projectName?: string | null
  typeField?: string | null
  status?: string | null
  tag?: string | null
  priority?: string | null
  retornos?: number
  retornosByAssignee?: Record<string, number>
  authorJiraAccountId?: string | null
  assigneeAccountId?: string | null
  started: string
  timeSpentSeconds: number
}

interface MonthStats {
  totalSeconds: number
  totalIssues: number
  novosPrototipos: number
  melhorias: number
  ajustes: number
  pesquisa: number
  usabilidade: number
  criticos: number
  outros: number
  aguardando: number
  retornos: number
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

// ─── Period utilities ─────────────────────────────────────────────────────────

const PERIOD_MONTHS: Record<string, number[]> = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
  H1: [0, 1, 2, 3, 4, 5],
  H2: [6, 7, 8, 9, 10, 11],
  FULL: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

function parsePeriod(value: string, fallbackYear: number): { year: number; activeMonths: number[] } {
  const dashIdx = value.lastIndexOf("-")
  if (dashIdx < 0) return { year: fallbackYear, activeMonths: PERIOD_MONTHS.FULL! }
  const yearStr = value.slice(dashIdx + 1)
  const periodKey = value.slice(0, dashIdx)
  const year = parseInt(yearStr, 10)
  return {
    year: isNaN(year) ? fallbackYear : year,
    activeMonths: PERIOD_MONTHS[periodKey] ?? PERIOD_MONTHS.FULL!,
  }
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

function emptyMonthStats(): MonthStats {
  return {
    totalSeconds: 0,
    totalIssues: 0,
    novosPrototipos: 0,
    melhorias: 0,
    ajustes: 0,
    pesquisa: 0,
    usabilidade: 0,
    criticos: 0,
    outros: 0,
    aguardando: 0,
    retornos: 0,
    investimentoCentavos: 0,
  }
}

function sumStats(a: MonthStats, b: MonthStats): MonthStats {
  return {
    totalSeconds: a.totalSeconds + b.totalSeconds,
    totalIssues: a.totalIssues + b.totalIssues,
    novosPrototipos: a.novosPrototipos + b.novosPrototipos,
    melhorias: a.melhorias + b.melhorias,
    ajustes: a.ajustes + b.ajustes,
    pesquisa: a.pesquisa + b.pesquisa,
    usabilidade: a.usabilidade + b.usabilidade,
    criticos: a.criticos + b.criticos,
    outros: a.outros + b.outros,
    aguardando: a.aguardando + b.aguardando,
    retornos: a.retornos + b.retornos,
    investimentoCentavos: a.investimentoCentavos + b.investimentoCentavos,
  }
}

/**
 * Retorna o valorHora (centavos) vigente para um dado mês/ano.
 * Usa o registro de progressão mais recente com data ≤ último dia do mês.
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
 * history pode estar em qualquer ordem — find() busca o primeiro match.
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

/**
 * Agrega entries de um único membro por mês.
 * O valorHora é determinado dinamicamente para cada mês com base no histórico de progressão.
 */
interface YearTypeTotals {
  novosPrototipos: number
  melhorias: number
  ajustes: number
  pesquisa: number
  usabilidade: number
  criticos: number
  outros: number
  aguardando: number
  retornos: number
  novosPrototiposSeconds: number
  melhorasSeconds: number
  ajustesSeconds: number
  pesquisaSeconds: number
  usabilidadeSeconds: number
  outrosSeconds: number
}

function aggregateYearTotals(entries: JiraEntry[], activeAccountIds?: Set<string>): YearTypeTotals {
  const novosProto = new Set<string>()
  const melhorias = new Set<string>()
  const ajustes = new Set<string>()
  const pesq = new Set<string>()
  const usab = new Set<string>()
  const criticos = new Set<string>()
  const outros = new Set<string>()
  const ag = new Set<string>()
  // retornos: sum per unique issue (take the max value seen for each key)
  const retornosPerIssue = new Map<string, number>()

  let novosPrototiposSeconds = 0
  let melhorasSeconds = 0
  let ajustesSeconds = 0
  let pesquisaSeconds = 0
  let usabilidadeSeconds = 0
  let outrosSeconds = 0

  for (const e of entries) {
    const tf = (e.typeField ?? "").trim().toLowerCase()
    const s = e.timeSpentSeconds
    if (tf === "new/redesign" || tf === "new" || tf === "redesign") { novosProto.add(e.issueKey); novosPrototiposSeconds += s }
    if (tf === "improvement") { melhorias.add(e.issueKey); melhorasSeconds += s }
    if (tf === "ajust/return" || tf === "adjustment/return") { ajustes.add(e.issueKey); ajustesSeconds += s }
    if (tf === "research") { pesq.add(e.issueKey); pesquisaSeconds += s }
    if (tf === "usability") { usab.add(e.issueKey); usabilidadeSeconds += s }
    if (tf === "others" || tf === "other") { outros.add(e.issueKey); outrosSeconds += s }
    if (e.priority?.toLowerCase().trim() === "critical") criticos.add(e.issueKey)
    if (e.status?.toLowerCase().trim() === "approval") ag.add(e.issueKey)
    const r = activeAccountIds && activeAccountIds.size > 0
      ? Array.from(activeAccountIds).reduce((s, id) => s + (e.retornosByAssignee?.[id] ?? 0), 0)
      : (e.retornos ?? 0)
    if (r > 0) {
      retornosPerIssue.set(e.issueKey, Math.max(retornosPerIssue.get(e.issueKey) ?? 0, r))
    }
  }

  // Merge untyped issues (not in any known type bucket) into "outros"
  const typedIssues = new Set([...novosProto, ...melhorias, ...ajustes, ...pesq, ...usab, ...outros])
  for (const e of entries) {
    if (!typedIssues.has(e.issueKey)) { outros.add(e.issueKey); outrosSeconds += e.timeSpentSeconds }
  }

  const retornos = Array.from(retornosPerIssue.values()).reduce((s, v) => s + v, 0)

  return {
    novosPrototipos: novosProto.size,
    melhorias: melhorias.size,
    ajustes: ajustes.size,
    pesquisa: pesq.size,
    usabilidade: usab.size,
    criticos: criticos.size,
    outros: outros.size,
    aguardando: ag.size,
    retornos,
    novosPrototiposSeconds,
    melhorasSeconds,
    ajustesSeconds,
    pesquisaSeconds,
    usabilidadeSeconds,
    outrosSeconds,
  }
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

// ─── UxAvatarStrip ─────────────────────────────────────────────────────────────

const AVATAR_STRIP_SIZE = 38

function UxAvatarStrip({
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

// Single source of truth for variant colours — shared by SparklineChart and MetricCard icon.
// "brand" uses the Agrotis primary (#00735D) from the design-system scale.
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

// Shared palette — 10 distinct colours for up to 5 series + Outros
const BAR_PALETTE = [
  "#5C9E8D", // teal primary
  "#5C7FA0", // slate primary
  "#C9A870", // amber primary
  "#CB8275", // coral primary
  "#83B8A8", // teal light
  "#8BAFC5", // slate light
  "#9A7835", // amber dark
  "#E8ADA3", // coral light
  "#3D7A6C", // teal dark
  "#3D5E7A", // slate dark
]

const LINE_MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

/**
 * Multi-line time series: X = selected months, Y = unique issue count,
 * one colored line per tag (top 5, rest grouped as "Outros").
 */
function TagLineChart({
  title,
  items,
  activeMonths,
  ariaLabel,
  totalCount,
}: {
  title: string
  items: { tag: string; count: number; countByMonth: number[] }[]
  activeMonths: number[]
  ariaLabel: string
  totalCount?: number
}) {
  const [activeKey, setActiveKey] = React.useState<string | null>(null)
  // Cap to top 5 tags; group the rest as "Outros"
  const sorted = [...items].sort((a, b) => b.count - a.count)
  const topItems = sorted.length <= 5 ? sorted : (() => {
    const top = sorted.slice(0, 5)
    const otherCountByMonth = sorted.slice(5).reduce<number[]>(
      (acc, item) => acc.map((v, i) => v + (item.countByMonth[i] ?? 0)),
      Array(12).fill(0) as number[],
    )
    const otherTotal = sorted.slice(5).reduce((s, item) => s + item.count, 0)
    return [...top, { tag: "Outros", count: otherTotal, countByMonth: otherCountByMonth }]
  })()

  // Build Recharts data: one point per active month, series keys = tag names
  const chartData = activeMonths.map((m) => {
    const obj: Record<string, string | number> = {
      month: LINE_MONTHS_SHORT[m] ?? String(m + 1),
    }
    for (const item of topItems) {
      obj[item.tag] = item.countByMonth[m] ?? 0
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
                    <div className="flex flex-wrap gap-x-2 gap-y-1 pb-6">
                      {payload.map((entry) => {
                        const isActive = activeKey === null || activeKey === entry.dataKey
                        return (
                          <button
                            key={entry.dataKey}
                            type="button"
                            onClick={() => setActiveKey((prev) => prev === entry.dataKey ? null : entry.dataKey)}
                            className="flex cursor-pointer items-center gap-1.5 rounded border border-border-default px-2 py-1 transition-all hover:bg-neutral-grey-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                            style={{ opacity: isActive ? 1 : 0.4, fontSize: 14, color: "#475569" }}
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
                  key={item.tag}
                  type="monotone"
                  dataKey={item.tag}
                  stroke={colors[index]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                  hide={activeKey !== null && activeKey !== item.tag}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── TagPieChart ──────────────────────────────────────────────────────────────

// Palette for pie segments — rotates across the three brand accent colours.
const PIE_COLORS = [
  "#5C9E8D", // teal primary
  "#5C7FA0", // slate primary
  "#C9A870", // amber primary
  "#CB8275", // coral primary
  "#83B8A8", // teal light
  "#8BAFC5", // slate light
  "#E8ADA3", // coral light
  "#DFC898", // amber light
  "#3D7A6C", // teal dark
  "#9A7835", // amber dark
  "#3D5E7A", // slate dark
  "#B56A5E", // coral dark
]

function TagPieChart({
  title,
  items,
  ariaLabel,
  totalCount,
}: {
  title: string
  items: { tag: string; count: number }[]
  ariaLabel: string
  totalCount?: number
}) {
  return (
    <div className="flex h-full flex-col rounded-xl bg-surface-card p-5 shadow-card">
      <p className="mb-3 text-sm font-semibold text-text-primary">
        {title}
        {totalCount != null && totalCount > 0 && (
          <span className="ml-1.5 font-normal text-text-secondary">({totalCount})</span>
        )}
      </p>
      {items.length === 0 ? (
        <div>
          <p className="text-sm text-text-secondary">Sem dados no período.</p>
          <p className="mt-1 text-xs text-text-secondary">Clique em Atualizar para sincronizar o status atual das jiras.</p>
        </div>
      ) : (
        <div role="img" aria-label={ariaLabel} className="flex flex-1 items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={items}
                dataKey="count"
                nameKey="tag"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {items.map((item, index) => (
                  <Cell
                    key={item.tag}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                    fillOpacity={0.9}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as { tag: string; count: number }
                  return (
                    <div className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs shadow-card">
                      <p className="mb-0.5 font-semibold text-text-primary">{d.tag}</p>
                      <p className="text-text-secondary">{d.count} {d.count === 1 ? "jira" : "jiras"}</p>
                    </div>
                  )
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "#6b7280", paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── YearTable ────────────────────────────────────────────────────────────────

const uxThBase = "px-3 py-3 text-xs font-semibold text-text-secondary"
function UxTH({ children, center, group }: { children: React.ReactNode; center?: boolean; group?: "blue" | "violet" }) {
  return (
    <th className={cn(uxThBase, center ? "text-center" : "text-right", group === "blue" && "bg-dashboard-group-green-bg/80 dark:bg-dashboard-group-green-bg/60", group === "violet" && "bg-dashboard-group-violet-bg/70 dark:bg-dashboard-group-violet-bg/60")}>
      {children}
    </th>
  )
}

// YearTable uses de-duplicated Sets for quarterly and total rows:
// quarterly row = union of its months' issue Sets (no double-counting across months),
// total row = union across all active months' issue Sets.
// This matches the MetricCards which also use global de-duplicated Sets.
function YearTable({ monthStats, hideValues, ano, activeMonths, quarterDedupeStats, periodTotalRow }: { monthStats: MonthStats[]; hideValues: boolean; ano: number; activeMonths: number[]; quarterDedupeStats: MonthStats[]; periodTotalRow: MonthStats }) {
  const activeMonthSet = new Set(activeMonths)
  const visibleQuarters = QUARTERS.map((q, qi) => ({ ...q, qi })).filter(q => q.months.some(m => activeMonthSet.has(m)))
  const today = new Date()
  const currentMonthIndex = ano === today.getFullYear() ? today.getMonth() : -1
  const inv = (v: number) =>
    hideValues ? <span className="tracking-widest text-text-disabled">••••</span> : formatBRL(v)

  const tdCls = (base: string, group?: "blue" | "violet") =>
    cn(base, group === "blue" && "bg-dashboard-group-green-bg/80 dark:bg-dashboard-group-green-bg/60", group === "violet" && "bg-dashboard-group-violet-bg/70 dark:bg-dashboard-group-violet-bg/60")

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
              Período
            </th>
            <UxTH>Investimento</UxTH>
            <UxTH>Horas</UxTH>
            <UxTH center>Jiras</UxTH>
            <UxTH center group="blue">Prototipação</UxTH>
            <UxTH center group="blue">Pesquisas</UxTH>
            <UxTH center group="blue">Usabilidade</UxTH>
            <UxTH center group="blue">Outros</UxTH>
            <UxTH center group="violet">Novos</UxTH>
            <UxTH center group="violet">Melhorias</UxTH>
            <UxTH center>Ajustes</UxTH>
            <UxTH center>Retornos</UxTH>
          </tr>
        </thead>
        <tbody>
          {visibleQuarters.map((q) => {
            // Sum only the months of this quarter that are in the active period
            const visibleMonths = q.months.filter(m => activeMonthSet.has(m))
            const qStats = quarterDedupeStats[q.qi] ?? emptyMonthStats()
            return (
              <React.Fragment key={q.label}>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{q.label}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{inv(qStats.investimentoCentavos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{formatHHMM(qStats.totalSeconds)}</td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary">{qStats.totalIssues}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.novosPrototipos + qStats.melhorias}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.pesquisa}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.usabilidade}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.outros}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "violet")}>{qStats.novosPrototipos}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "violet")}>{qStats.melhorias}</td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary">{qStats.ajustes}</td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary">{qStats.retornos}</td>
                </tr>
                {visibleMonths.map((mi) => {
                  const ms = monthStats[mi]!
                  return (
                    <tr
                      key={mi}
                      className={cn(
                        "border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/50",
                        mi === currentMonthIndex && "[&_td]:!text-chart-4 [&_td]:font-semibold",
                      )}
                    >
                      <td className="px-4 py-2 pl-8 text-text-secondary">{MONTHS_PT[mi]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{inv(ms.investimentoCentavos)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{formatHHMM(ms.totalSeconds)}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-text-primary">{ms.totalIssues}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.novosPrototipos + ms.melhorias}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.pesquisa}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.usabilidade}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.outros}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "violet")}>{ms.novosPrototipos}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "violet")}>{ms.melhorias}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-text-primary">{ms.ajustes}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-text-primary">{ms.retornos}</td>
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
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.novosPrototipos + periodTotalRow.melhorias}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.pesquisa}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.usabilidade}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.outros}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "violet")}>{periodTotalRow.novosPrototipos}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "violet")}>{periodTotalRow.melhorias}</td>
            <td className="px-3 py-2.5 text-center font-bold tabular-nums text-text-primary">{periodTotalRow.ajustes}</td>
            <td className="px-3 py-2.5 text-center font-bold tabular-nums text-text-primary">{periodTotalRow.retornos}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── TypeCard ─────────────────────────────────────────────────────────────────

// Palette aligned with VARIANT_COLOR: warning = same #CB8275 used by MetricCard "Total de Críticos"
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
  /** When provided, percentage is calculated against this value instead of totalIssues.
   *  Use for sub-group cards (e.g. Novos/Melhorias/Ajustes within Prototipação) so they sum to 100%. */
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

// ─── Main component ────────────────────────────────────────────────────────────

export function UxDashboardClient({ membros, progressaoMap, approvalIssues, memberJiraIds }: Props) {
  const currentYear = new Date().getFullYear()
  const [periodValue, setPeriodValue] = React.useState(() => defaultPeriodValue(currentYear))
  const [loading, setLoading] = React.useState(true)
  const [hideValues, setHideValues] = React.useState(true)
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
  // Raw entries per userId — fetched once per year, filtered in useMemo
  const [rawMemberEntries, setRawMemberEntries] = React.useState<Record<string, JiraEntry[]>>({})
  // Approval issues — initially from SSR prop, refreshed alongside worklogs
  const [liveApprovalIssues, setLiveApprovalIssues] = React.useState(approvalIssues)

  // Derive year and active months from period selection
  const { year: ano, activeMonths } = React.useMemo(
    () => parsePeriod(periodValue, currentYear),
    [periodValue, currentYear],
  )

  const periodOptions = React.useMemo(() => buildPeriodOptions(currentYear), [currentYear])

  // Toggle a user in/out of the selection
  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  // ── Visible members ────────────────────────────────────────────────────────
  // Um membro é exibido apenas se:
  //   1. Possui ao menos um lançamento no período selecionado (activeMonths), E
  //   2. Não foi desligado ANTES do início do período.
  //      Exemplo: desligamento em mai/2026, período = Q2/2026 → exibe (período contém o desligamento)
  //               desligamento em mai/2026, período = Q3/2026 → oculta (desligado antes do período)
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

  // Limpar seleções que não são mais visíveis (ex.: mudança de ano ou desligamento)
  React.useEffect(() => {
    const visibleIds = new Set(visibleMembros.map((m) => m.userId))
    setSelectedUserIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [visibleMembros])

  // ── Derived stats (instant — no fetch on user toggle) ─────────────────────
  const { monthStats, totalUniqueIssues, yearTotals, distribByTag, approvalByTag, quarterDedupeStats, periodTotalRow } = React.useMemo(() => {
    const empty: YearTypeTotals = {
      novosPrototipos: 0, melhorias: 0, ajustes: 0, pesquisa: 0,
      usabilidade: 0, criticos: 0, outros: 0, aguardando: 0, retornos: 0,
      novosPrototiposSeconds: 0, melhorasSeconds: 0, ajustesSeconds: 0,
      pesquisaSeconds: 0, usabilidadeSeconds: 0, outrosSeconds: 0,
    }
    // Filter approval issues by selected member's Jira account IDs (from memberJiraIds prop).
    // When no user is selected, all issues are shown.
    const activeApprovalJiraIds = new Set(
      selectedUserIds
        .map((uid) => memberJiraIds[uid])
        .filter((id): id is string => !!id),
    )
    const filteredApprovalIssues = activeApprovalJiraIds.size > 0
      ? liveApprovalIssues.filter(
          (i) => i.assigneeAccountId != null && activeApprovalJiraIds.has(i.assigneeAccountId),
        )
      : liveApprovalIssues

    if (Object.keys(rawMemberEntries).length === 0) {
      // Worklog data not yet loaded — show approval issues (filtered by member if selected)
      const approvalTagMap = new Map<string, number>()
      for (const i of filteredApprovalIssues) {
        approvalTagMap.set(i.tag, (approvalTagMap.get(i.tag) ?? 0) + 1)
      }
      return {
        monthStats: null,
        totalUniqueIssues: 0,
        yearTotals: empty,
        distribByTag: [] as { tag: string; count: number; investimentoCentavos: number; countByMonth: number[] }[],
        approvalByTag: [...approvalTagMap.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count),
        quarterDedupeStats: QUARTERS.map(() => emptyMonthStats()),
        periodTotalRow: emptyMonthStats(),
      }
    }

    const combined: MonthStats[] = Array.from({ length: 12 }, emptyMonthStats)
    const allEntries: JiraEntry[] = []
    // Per-tag, per-month investment (index = month 0–11) for period-scoped distribByTag
    const tagMonthInvestmentMap = new Map<string, number[]>()

    // Pass 1 — per-member: accumulate hours and investment only.
    // valorHora differs per member so this must stay per-member.
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
          const tag = e.tag?.trim() || "Sem tag"
          const tagArr = tagMonthInvestmentMap.get(tag) ?? (new Array(12).fill(0) as number[])
          tagArr[month] = (tagArr[month] ?? 0) + cost
          tagMonthInvestmentMap.set(tag, tagArr)
        }
      }
    }

    // Per-tag, per-month unique issue counts — used by TagLineChart.
    // Each (issueKey, tag, month) triplet is counted once.
    const tagMonthIssueCountMap = new Map<string, number[]>()
    const seenIssueTagMonth = new Set<string>()
    for (const e of allEntries) {
      const month = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      if (month < 0 || month > 11) continue
      const tag = e.tag?.trim() || "Sem tag"
      const key = `${e.issueKey}\x00${tag}\x00${month}`
      if (seenIssueTagMonth.has(key)) continue
      seenIssueTagMonth.add(key)
      if (!tagMonthIssueCountMap.has(tag)) tagMonthIssueCountMap.set(tag, Array(12).fill(0) as number[])
      tagMonthIssueCountMap.get(tag)![month]!++
    }

    // Collect Jira account IDs for all active members — used to filter retornos
    // consistently in both the table (Pass 2) and the year-total cards.
    const activeJiraAccountIds = new Set<string>()
    for (const m of activeMembers) {
      const firstEntry = (rawMemberEntries[m.userId] ?? []).find((e) => e.authorJiraAccountId)
      if (firstEntry?.authorJiraAccountId) activeJiraAccountIds.add(firstEntry.authorJiraAccountId)
    }

    // Pass 2 — global: count unique issues per month.
    // An issue is counted in EVERY month it has a worklog in (not just its first month),
    // so combined[m].totalIssues matches what lançamentos shows for each month.
    // canonical typeField (first non-empty typeField per issue) prevents double-counting
    // issues whose worklogs carry inconsistent typeField values.

    // Canonical typeField per issue: first non-empty typeField across all entries.
    const issueCanonicalType = new Map<string, string>()
    for (const e of allEntries) {
      if (!issueCanonicalType.has(e.issueKey)) {
        const tf = (e.typeField ?? "").trim().toLowerCase()
        if (tf) issueCanonicalType.set(e.issueKey, tf)
      }
    }

    type UxCB = {
      all: Set<string>; novosProto: Set<string>; melhorias: Set<string>
      ajustes: Set<string>; pesq: Set<string>; usab: Set<string>
      criticos: Set<string>; outros: Set<string>; ag: Set<string>
      retornosPerIssue: Map<string, number>
    }
    const buckets: UxCB[] = Array.from({ length: 12 }, () => ({
      all: new Set(), novosProto: new Set(), melhorias: new Set(),
      ajustes: new Set(), pesq: new Set(), usab: new Set(),
      criticos: new Set(), outros: new Set(), ag: new Set(),
      retornosPerIssue: new Map(),
    }))

    for (const e of allEntries) {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      if (m < 0 || m > 11) continue
      const cb = buckets[m]!
      const tf = issueCanonicalType.get(e.issueKey) ?? ""
      cb.all.add(e.issueKey)
      if (tf === "new/redesign" || tf === "new" || tf === "redesign") cb.novosProto.add(e.issueKey)
      if (tf === "improvement") cb.melhorias.add(e.issueKey)
      if (tf === "ajust/return" || tf === "adjustment/return") cb.ajustes.add(e.issueKey)
      if (tf === "research") cb.pesq.add(e.issueKey)
      if (tf === "usability") cb.usab.add(e.issueKey)
      if (tf === "others" || tf === "other") cb.outros.add(e.issueKey)
      if (e.priority?.toLowerCase().trim() === "critical") cb.criticos.add(e.issueKey)
      const sl = (e.status ?? "").toLowerCase().trim()
      if (sl.includes("approval") || sl.includes("aprova")) cb.ag.add(e.issueKey)
      const r = activeJiraAccountIds.size > 0
        ? Array.from(activeJiraAccountIds).reduce((s, id) => s + (e.retornosByAssignee?.[id] ?? 0), 0)
        : (e.retornos ?? 0)
      if (r > 0) cb.retornosPerIssue.set(e.issueKey, Math.max(cb.retornosPerIssue.get(e.issueKey) ?? 0, r))
    }

    // Merge untyped issues into "outros"
    for (const cb of buckets) {
      const typed = new Set([...cb.novosProto, ...cb.melhorias, ...cb.ajustes, ...cb.pesq, ...cb.usab, ...cb.outros])
      for (const key of cb.all) { if (!typed.has(key)) cb.outros.add(key) }
    }

    // Overlay issue counts onto combined (hours/investment already set in pass 1)
    for (let i = 0; i < 12; i++) {
      const cb = buckets[i]!
      combined[i]!.totalIssues = cb.all.size
      combined[i]!.novosPrototipos = cb.novosProto.size
      combined[i]!.melhorias = cb.melhorias.size
      combined[i]!.ajustes = cb.ajustes.size
      combined[i]!.pesquisa = cb.pesq.size
      combined[i]!.usabilidade = cb.usab.size
      combined[i]!.criticos = cb.criticos.size
      combined[i]!.outros = cb.outros.size
      combined[i]!.aguardando = cb.ag.size
      combined[i]!.retornos = Array.from(cb.retornosPerIssue.values()).reduce((s, v) => s + v, 0)
    }

    const dedupeUxStats = (monthIndices: number[]): MonthStats => {
      const allSet = new Set<string>(); const ndSet = new Set<string>()
      const mlSet = new Set<string>(); const ajSet = new Set<string>()
      const psSet = new Set<string>(); const usSet = new Set<string>()
      const crSet = new Set<string>(); const otSet = new Set<string>()
      const agSet = new Set<string>()
      const retMap = new Map<string, number>()
      for (const m of monthIndices) {
        const cb = buckets[m]!
        for (const k of cb.all) allSet.add(k)
        for (const k of cb.novosProto) ndSet.add(k)
        for (const k of cb.melhorias) mlSet.add(k)
        for (const k of cb.ajustes) ajSet.add(k)
        for (const k of cb.pesq) psSet.add(k)
        for (const k of cb.usab) usSet.add(k)
        for (const k of cb.criticos) crSet.add(k)
        for (const k of cb.outros) otSet.add(k)
        for (const k of cb.ag) agSet.add(k)
        for (const [k, v] of cb.retornosPerIssue) retMap.set(k, Math.max(retMap.get(k) ?? 0, v))
      }
      return {
        totalSeconds: monthIndices.reduce((s, m) => s + (combined[m]?.totalSeconds ?? 0), 0),
        investimentoCentavos: monthIndices.reduce((s, m) => s + (combined[m]?.investimentoCentavos ?? 0), 0),
        totalIssues: allSet.size, novosPrototipos: ndSet.size, melhorias: mlSet.size,
        ajustes: ajSet.size, pesquisa: psSet.size, usabilidade: usSet.size,
        criticos: crSet.size, outros: otSet.size, aguardando: agSet.size,
        retornos: Array.from(retMap.values()).reduce((s, v) => s + v, 0),
      }
    }

    const quarterDedupeStats: MonthStats[] = QUARTERS.map(q => dedupeUxStats(q.months))
    const periodTotalRow = dedupeUxStats(activeMonths)

    // Entries from active months only (for yearTotals seconds and distribByTag)
    const anchoredEntries = allEntries.filter(e => {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      return activeMonths.includes(m)
    })

    // Period-level unique counts and type totals for the metric cards
    let novosPrototiposSeconds = 0, melhorasSeconds = 0, ajustesSeconds = 0
    let pesquisaSeconds = 0, usabilidadeSeconds = 0, outrosSeconds = 0
    for (const e of anchoredEntries) {
      const tf = issueCanonicalType.get(e.issueKey) ?? ""
      const s = e.timeSpentSeconds
      if (tf === "new/redesign" || tf === "new" || tf === "redesign") novosPrototiposSeconds += s
      else if (tf === "improvement") melhorasSeconds += s
      else if (tf === "ajust/return" || tf === "adjustment/return") ajustesSeconds += s
      else if (tf === "research") pesquisaSeconds += s
      else if (tf === "usability") usabilidadeSeconds += s
      else outrosSeconds += s
    }
    const yTotals: YearTypeTotals = {
      novosPrototipos: periodTotalRow.novosPrototipos, melhorias: periodTotalRow.melhorias,
      ajustes: periodTotalRow.ajustes, pesquisa: periodTotalRow.pesquisa,
      usabilidade: periodTotalRow.usabilidade, criticos: periodTotalRow.criticos,
      outros: periodTotalRow.outros, aguardando: periodTotalRow.aguardando,
      retornos: periodTotalRow.retornos,
      novosPrototiposSeconds, melhorasSeconds, ajustesSeconds,
      pesquisaSeconds, usabilidadeSeconds, outrosSeconds,
    }

    // Group anchored issues by tag for Jiras por Produto
    const tagDistribMap = new Map<string, Set<string>>()
    for (const e of anchoredEntries) {
      const tag = e.tag?.trim() || "Sem tag"
      if (!tagDistribMap.has(tag)) tagDistribMap.set(tag, new Set())
      tagDistribMap.get(tag)!.add(e.issueKey)
    }

    // Period-scoped investment per tag: sum across active months only
    const periodTagInvestment = (tag: string): number =>
      activeMonths.reduce((s, m) => s + (tagMonthInvestmentMap.get(tag)?.[m] ?? 0), 0)

    const toTagItems = (m: Map<string, Set<string>>) =>
      [...m.entries()]
        .map(([tag, keys]) => ({
          tag,
          count: keys.size,
          investimentoCentavos: periodTagInvestment(tag),
          countByMonth: tagMonthIssueCountMap.get(tag) ?? (Array(12).fill(0) as number[]),
        }))
        .sort((a, b) => b.count - a.count)

    const approvalTagMap = new Map<string, number>()
    for (const i of filteredApprovalIssues) {
      approvalTagMap.set(i.tag, (approvalTagMap.get(i.tag) ?? 0) + 1)
    }
    const approvalByTag = [...approvalTagMap.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)

    return {
      monthStats: combined,
      totalUniqueIssues: periodTotalRow.totalIssues,
      yearTotals: yTotals,
      distribByTag: toTagItems(tagDistribMap),
      approvalByTag,
      quarterDedupeStats,
      periodTotalRow,
    }
  }, [rawMemberEntries, activeMembers, progressaoMap, ano, activeMonths, liveApprovalIssues, selectedUserIds, memberJiraIds])

  // ── Derived totals for metric cards (period-scoped) ──────────────────────
  const totalAnual = React.useMemo(
    () => activeMonths.reduce((acc, m) => sumStats(acc, (monthStats ?? [])[m] ?? emptyMonthStats()), emptyMonthStats()),
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

  // ── Sparklines — one point per active month ───────────────────────────────
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

  // ── Fetch all members on year change (uses cache) ─────────────────────────
  const fetchAll = React.useCallback(
    async (year: number, force = false) => {
      setRawMemberEntries({})
      setLoading(true)
      try {
        const [worklogResults, freshApproval] = await Promise.all([
          membros.length === 0
            ? Promise.resolve([] as [string, JiraEntry[]][])
            : Promise.all(
                membros.map(async (m) => {
                  try {
                    const { entries } = await getUxWorklogsForYear(m.userId, year, force)
                    return [m.userId, entries] as const
                  } catch {
                    return [m.userId, [] as JiraEntry[]] as const
                  }
                }),
              ),
          getApprovalIssuesByTag("UX"),
        ])
        setRawMemberEntries(Object.fromEntries(worklogResults))
        setLiveApprovalIssues(freshApproval)
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
      {loading ? (
        <SectionSpinner minHeight="min-h-[400px]" label="Carregando dados..." />
      ) : (
        <>
          {/* Avatar strip + period selector na mesma linha */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              {visibleMembros.length > 0 && (
                <UxAvatarStrip
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
              value={formatDurationAvg(avgSecondsPerIssue)}
              icon={Clock}
              iconVariant="brand"
              sparkData={sparkTempo}
              sparkFormatter={formatDurationAvg}
            />
            <MetricCard
              label="Custo médio 🠆 Jira"
              value={formatBRL(avgInvestimentoCentavos)}
              icon={DollarSign}
              iconVariant="success"
              sensitive
              hidden={hideValues}
              sparkData={sparkValor}
              sparkFormatter={formatBRL}
            />
            <MetricCard
              label="Total de Jiras"
              value={String(totalUniqueIssues)}
              icon={BarChart2}
              iconVariant="info"
              sparkData={sparkJiras}
              sparkFormatter={(v) => `${v} jira${v !== 1 ? "s" : ""}`}
            />
            <MetricCard
              label="Total de Críticos"
              value={String(yearTotals.criticos)}
              icon={AlertTriangle}
              iconVariant="warning"
              sparkData={sparkCriticos}
              sparkFormatter={(v) => `${v} crítico${v !== 1 ? "s" : ""}`}
            />
          </div>

          {/* Metric cards — linha 2: Prototipação, Pesquisas, Usabilidade, Outros, Novos, Melhorias, Ajustes, Retornos */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
            {/* Group: scope / visão global — blue tint */}
            <TypeCard label="Prototipação" count={yearTotals.novosPrototipos + yearTotals.melhorias} totalIssues={totalUniqueIssues} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.novosPrototiposSeconds + yearTotals.melhorasSeconds} hideValues={hideValues} tint="blue" />
            <TypeCard label="Pesquisas"    count={yearTotals.pesquisa}      totalIssues={totalUniqueIssues} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.pesquisaSeconds}    hideValues={hideValues} tint="blue" />
            <TypeCard label="Usabilidade"  count={yearTotals.usabilidade}   totalIssues={totalUniqueIssues} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.usabilidadeSeconds}  hideValues={hideValues} tint="blue" />
            <TypeCard label="Outros"       count={yearTotals.outros}        totalIssues={totalUniqueIssues} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.outrosSeconds}       hideValues={hideValues} tint="blue" />
            {/* Group: delivery sub-types — violet tint; pct relative to Prototipação so they sum to 100% */}
            {(() => {
              const prototiposTotal = yearTotals.novosPrototipos + yearTotals.melhorias
              return (
                <>
                  <TypeCard label="Novos"     count={yearTotals.novosPrototipos} totalIssues={totalUniqueIssues} pctDenominator={prototiposTotal} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.novosPrototiposSeconds} hideValues={hideValues} tint="violet" />
                  <TypeCard label="Melhorias" count={yearTotals.melhorias}       totalIssues={totalUniqueIssues} pctDenominator={prototiposTotal} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.melhorasSeconds}        hideValues={hideValues} tint="violet" />
                </>
              )
            })()}
            {/* Isolated: adjustments and returns — warning (coral) tint */}
            <TypeCard label="Ajustes"  count={yearTotals.ajustes}  totalIssues={totalUniqueIssues} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={yearTotals.ajustesSeconds} hideValues={hideValues} tint="warning" />
            <TypeCard label="Retornos" count={yearTotals.retornos} totalIssues={totalUniqueIssues} totalInvestimentoCentavos={totalAnual.investimentoCentavos} timeSpentSeconds={0} hideValues={hideValues} tint="warning" />
          </div>

          {/* Tag breakdown charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <TagLineChart
                title="Jiras por Produto"
                items={distribByTag}
                activeMonths={activeMonths}
                ariaLabel="Distribuição de jiras por produto"
                totalCount={distribByTag.reduce((s, i) => s + i.count, 0)}
              />
            </div>
            <div className="lg:col-span-1">
              <TagPieChart
                title="Jiras aguardando aprovação"
                items={approvalByTag}
                ariaLabel="Prototipação em aprovação por tag"
                totalCount={approvalByTag.reduce((s, i) => s + i.count, 0)}
              />
            </div>
          </div>

          {/* Yearly table */}
          {monthStats === null ? (
            <SectionSpinner minHeight="min-h-[300px]" />
          ) : (
            <YearTable monthStats={monthStats} hideValues={hideValues} ano={ano} activeMonths={activeMonths} quarterDedupeStats={quarterDedupeStats} periodTotalRow={periodTotalRow} />
          )}
        </>
      )}
    </div>
  )
}
