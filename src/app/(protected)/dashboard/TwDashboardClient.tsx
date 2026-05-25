"use client"

import * as React from "react"
import { AlertTriangle, BarChart2, Clock, Eye, EyeOff, Info, RefreshCw, TrendingUp } from "lucide-react"
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
  /** Issues em aprovação com assignee — consultadas ao vivo via JQL. */
  approvalIssues: { tag: string; assigneeAccountId: string | null }[]
  /** userId → Jira accountId, resolvido por e-mail no servidor. */
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
  started: string
  timeSpentSeconds: number
}

// TW-specific monthly stats — fields differ from the UX MonthStats
interface TwMonthStats {
  totalSeconds: number
  totalIssues: number
  novasDocs: number
  revisoes: number
  outrasAtividades: number
  criticos: number
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
  const cy = currentYear
  const py = currentYear - 1
  return [
    { value: `Q1-${cy}`, label: `1° Trimestre / ${cy}`, group: "q" as const },
    { value: `Q2-${cy}`, label: `2° Trimestre / ${cy}`, group: "q" as const },
    { value: `Q3-${cy}`, label: `3° Trimestre / ${cy}`, group: "q" as const },
    { value: `Q4-${cy}`, label: `4° Trimestre / ${cy}`, group: "q" as const },
    { value: `H1-${cy}`, label: `1° Semestre / ${cy}`, group: "h" as const },
    { value: `H2-${cy}`, label: `2° Semestre / ${cy}`, group: "h" as const },
    { value: `FULL-${cy}`, label: `${cy}`, group: "y" as const },
    { value: `FULL-${py}`, label: `${py}`, group: "y" as const },
  ]
}

function defaultPeriodValue(currentYear: number): string {
  const q = Math.floor(new Date().getMonth() / 3) + 1
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

function emptyTwMonthStats(): TwMonthStats {
  return {
    totalSeconds: 0,
    totalIssues: 0,
    novasDocs: 0,
    revisoes: 0,
    outrasAtividades: 0,
    criticos: 0,
    aguardando: 0,
    retornos: 0,
    investimentoCentavos: 0,
  }
}

function sumTwStats(a: TwMonthStats, b: TwMonthStats): TwMonthStats {
  return {
    totalSeconds: a.totalSeconds + b.totalSeconds,
    totalIssues: a.totalIssues + b.totalIssues,
    novasDocs: a.novasDocs + b.novasDocs,
    revisoes: a.revisoes + b.revisoes,
    outrasAtividades: a.outrasAtividades + b.outrasAtividades,
    criticos: a.criticos + b.criticos,
    aguardando: a.aguardando + b.aguardando,
    retornos: a.retornos + b.retornos,
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

// ─── TW year-level totals ──────────────────────────────────────────────────────

interface TwYearTotals {
  novasDocs: number
  revisoes: number
  outrasAtividades: number
  criticos: number
  aguardando: number
  retornos: number
  novasDocsSeconds: number
  revisoesSeconds: number
  outrasAtividadesSeconds: number
}

/**
 * Agrega entries TW por tipo para os cards de ano.
 * Mapeamento:
 *   "new documentation"   → novasDocs
 *   "documentation review"→ revisoes
 *   "others" / "other"    → outrasAtividades
 *   qualquer outro tipo   → outrasAtividades (bucket residual)
 */
function aggregateTwYearTotals(entries: JiraEntry[], activeAccountIds?: Set<string>): TwYearTotals {
  const novasDocs = new Set<string>()
  const revisoes = new Set<string>()
  const outrasAtividades = new Set<string>()
  const criticos = new Set<string>()
  const ag = new Set<string>()
  const retornosPerIssue = new Map<string, number>()

  let novasDocsSeconds = 0
  let revisoesSeconds = 0
  let outrasAtividadesSeconds = 0

  // Build canonical typeField per issue: first non-empty typeField seen.
  // Prevents an issue with mixed typeFields on different worklogs from being
  // counted in multiple type buckets simultaneously.
  const issueCanonicalTypeYr = new Map<string, string>()
  for (const e of entries) {
    if (!issueCanonicalTypeYr.has(e.issueKey)) {
      const tf = (e.typeField ?? "").trim().toLowerCase()
      if (tf) issueCanonicalTypeYr.set(e.issueKey, tf)
    }
  }

  for (const e of entries) {
    const tf = issueCanonicalTypeYr.get(e.issueKey) ?? ""
    const s = e.timeSpentSeconds
    if (tf === "new documentation") { novasDocs.add(e.issueKey); novasDocsSeconds += s }
    else if (tf === "documentation review") { revisoes.add(e.issueKey); revisoesSeconds += s }
    else if (tf === "others" || tf === "other") { outrasAtividades.add(e.issueKey); outrasAtividadesSeconds += s }
    if (e.priority?.toLowerCase().trim() === "critical") criticos.add(e.issueKey)
    if (e.status?.toLowerCase().trim() === "approval") ag.add(e.issueKey)
    const r = activeAccountIds && activeAccountIds.size > 0
      ? Array.from(activeAccountIds).reduce((s, id) => s + (e.retornosByAssignee?.[id] ?? 0), 0)
      : (e.retornos ?? 0)
    if (r > 0) {
      retornosPerIssue.set(e.issueKey, Math.max(retornosPerIssue.get(e.issueKey) ?? 0, r))
    }
  }

  // Residual: issues not in any named bucket → outrasAtividades
  const typedIssues = new Set([...novasDocs, ...revisoes, ...outrasAtividades])
  for (const e of entries) {
    if (!typedIssues.has(e.issueKey)) { outrasAtividades.add(e.issueKey); outrasAtividadesSeconds += e.timeSpentSeconds }
  }

  const retornos = Array.from(retornosPerIssue.values()).reduce((s, v) => s + v, 0)

  return {
    novasDocs: novasDocs.size,
    revisoes: revisoes.size,
    outrasAtividades: outrasAtividades.size,
    criticos: criticos.size,
    aguardando: ag.size,
    retornos,
    novasDocsSeconds,
    revisoesSeconds,
    outrasAtividadesSeconds,
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
const BAR_COLOR = BAR_PALETTE[0]

function TagBarChart({
  title,
  items,
  ariaLabel,
  hideValues,
  totalCount,
}: {
  title: string
  items: { tag: string; count: number; investimentoCentavos: number }[]
  ariaLabel: string
  hideValues?: boolean
  totalCount?: number
}) {
  const chartHeight = Math.max(300, items.length * 28)
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="mb-4 text-sm font-semibold text-text-primary">
        {title}
        {totalCount != null && totalCount > 0 && (
          <span className="ml-1.5 font-normal text-text-secondary">({totalCount})</span>
        )}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Sem dados no período.</p>
      ) : (
        <div role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={items} margin={{ top: 8, right: 16, bottom: 40, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
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
                cursor={{ stroke: BAR_COLOR, strokeWidth: 1, strokeDasharray: "3 3" }}
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
              <Line
                type="monotone"
                dataKey="count"
                stroke={BAR_COLOR}
                strokeWidth={2}
                dot={{ fill: BAR_COLOR, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: BAR_COLOR, strokeWidth: 0 }}
                isAnimationActive={true}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── TagPieChart ──────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#5C9E8D", "#5C7FA0", "#C9A870", "#CB8275",
  "#83B8A8", "#8BAFC5", "#E8ADA3", "#DFC898",
  "#3D7A6C", "#9A7835", "#3D5E7A", "#B56A5E",
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

// ─── YearTable TW ─────────────────────────────────────────────────────────────

function TwYearTable({
  monthStats,
  hideValues,
  ano,
  activeMonths,
  quarterDedupeStats,
  periodTotalRow,
}: {
  monthStats: TwMonthStats[]
  hideValues: boolean
  ano: number
  activeMonths: number[]
  quarterDedupeStats: TwMonthStats[]
  periodTotalRow: TwMonthStats
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
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
              Período
            </th>
            <TH>Investimento</TH>
            <TH>Horas</TH>
            <TH center>Jiras</TH>
            <TH center group="blue">Novos Docs</TH>
            <TH center group="blue">Revisões</TH>
            <TH center group="blue">Outros</TH>
            <TH center>
              <TooltipProvider delay={400} closeDelay={0}>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex cursor-default items-center gap-1">Retornos<Info className="h-3 w-3 text-text-disabled" /></span>} />
                  <TooltipContent>Issues devolvidos do status Aprovação para In Progress — indica retrabalho.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TH>
          </tr>
        </thead>
        <tbody>
          {visibleQuarters.map((q) => {
            const visibleMonths = q.months.filter(m => activeMonthSet.has(m))
            const qStats = quarterDedupeStats[q.qi] ?? emptyTwMonthStats()
            return (
              <React.Fragment key={q.label}>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{q.label}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{inv(qStats.investimentoCentavos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{formatHHMM(qStats.totalSeconds)}</td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary">{qStats.totalIssues}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.novasDocs}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.revisoes}</td>
                  <td className={tdCls("px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary", "blue")}>{qStats.outrasAtividades}</td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-text-primary">{qStats.retornos}</td>
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
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.novasDocs}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.revisoes}</td>
                      <td className={tdCls("px-3 py-2 text-center tabular-nums text-text-primary", "blue")}>{ms.outrasAtividades}</td>
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
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.novasDocs}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.revisoes}</td>
            <td className={tdCls("px-3 py-2.5 text-center font-bold tabular-nums text-text-primary", "blue")}>{periodTotalRow.outrasAtividades}</td>
            <td className="px-3 py-2.5 text-center font-bold tabular-nums text-text-primary">{periodTotalRow.retornos}</td>
          </tr>
        </tbody>
      </table>
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

// ─── Main component ────────────────────────────────────────────────────────────

export function TwDashboardClient({ membros, progressaoMap, approvalIssues, memberJiraIds }: Props) {
  const currentYear = new Date().getFullYear()
  const [periodValue, setPeriodValue] = React.useState(() => defaultPeriodValue(currentYear))
  const [loading, setLoading] = React.useState(false)
  const [hideValues, setHideValues] = React.useState(true)
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
  const [rawMemberEntries, setRawMemberEntries] = React.useState<Record<string, JiraEntry[]>>({})
  const [liveApprovalIssues, setLiveApprovalIssues] = React.useState(approvalIssues)

  const { year: ano, activeMonths } = React.useMemo(
    () => parsePeriod(periodValue, currentYear),
    [periodValue, currentYear],
  )

  const periodOptions = React.useMemo(() => buildPeriodOptions(currentYear), [currentYear])

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

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { monthStats, totalUniqueIssues, yearTotals, distribByTag, approvalByTag, quarterDedupeStats, periodTotalRow } = React.useMemo(() => {
    const empty: TwYearTotals = {
      novasDocs: 0, revisoes: 0, outrasAtividades: 0,
      criticos: 0, aguardando: 0, retornos: 0,
      novasDocsSeconds: 0, revisoesSeconds: 0, outrasAtividadesSeconds: 0,
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
      const approvalTagMap = new Map<string, number>()
      for (const i of filteredApprovalIssues) {
        approvalTagMap.set(i.tag, (approvalTagMap.get(i.tag) ?? 0) + 1)
      }
      return {
        monthStats: null,
        totalUniqueIssues: 0,
        yearTotals: empty,
        distribByTag: [] as { tag: string; count: number; investimentoCentavos: number }[],
        approvalByTag: [...approvalTagMap.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count),
        quarterDedupeStats: QUARTERS.map(() => emptyTwMonthStats()),
        periodTotalRow: emptyTwMonthStats(),
      }
    }

    const combined: TwMonthStats[] = Array.from({ length: 12 }, emptyTwMonthStats)
    const allEntries: JiraEntry[] = []
    const tagMonthInvestmentMap = new Map<string, number[]>()

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
          const tag = e.tag?.trim() || "Sem tag"
          const tagArr = tagMonthInvestmentMap.get(tag) ?? (new Array(12).fill(0) as number[])
          tagArr[month] = (tagArr[month] ?? 0) + cost
          tagMonthInvestmentMap.set(tag, tagArr)
        }
      }
    }

    // Collect Jira account IDs for active members
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

    type TwCB = {
      all: Set<string>
      novasDocs: Set<string>
      revisoes: Set<string>
      outrasAtividades: Set<string>
      criticos: Set<string>
      ag: Set<string>
      retornosPerIssue: Map<string, number>
    }
    const buckets: TwCB[] = Array.from({ length: 12 }, () => ({
      all: new Set(),
      novasDocs: new Set(),
      revisoes: new Set(),
      outrasAtividades: new Set(),
      criticos: new Set(),
      ag: new Set(),
      retornosPerIssue: new Map(),
    }))

    for (const e of allEntries) {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      if (m < 0 || m > 11) continue
      const cb = buckets[m]!
      cb.all.add(e.issueKey)
      const tf = issueCanonicalType.get(e.issueKey) ?? ""
      if (tf === "new documentation") cb.novasDocs.add(e.issueKey)
      else if (tf === "documentation review") cb.revisoes.add(e.issueKey)
      else if (tf === "others" || tf === "other") cb.outrasAtividades.add(e.issueKey)
      if (e.priority?.toLowerCase().trim() === "critical") cb.criticos.add(e.issueKey)
      const sl = (e.status ?? "").toLowerCase().trim()
      if (sl.includes("approval") || sl.includes("aprova")) cb.ag.add(e.issueKey)
      const r = activeJiraAccountIds.size > 0
        ? Array.from(activeJiraAccountIds).reduce((s, id) => s + (e.retornosByAssignee?.[id] ?? 0), 0)
        : (e.retornos ?? 0)
      if (r > 0) cb.retornosPerIssue.set(e.issueKey, Math.max(cb.retornosPerIssue.get(e.issueKey) ?? 0, r))
    }

    // Residual: issues not in any named type bucket → outrasAtividades
    for (const cb of buckets) {
      const typed = new Set([...cb.novasDocs, ...cb.revisoes, ...cb.outrasAtividades])
      for (const key of cb.all) { if (!typed.has(key)) cb.outrasAtividades.add(key) }
    }

    for (let i = 0; i < 12; i++) {
      const cb = buckets[i]!
      combined[i]!.totalIssues = cb.all.size
      combined[i]!.novasDocs = cb.novasDocs.size
      combined[i]!.revisoes = cb.revisoes.size
      combined[i]!.outrasAtividades = cb.outrasAtividades.size
      combined[i]!.criticos = cb.criticos.size
      combined[i]!.aguardando = cb.ag.size
      combined[i]!.retornos = Array.from(cb.retornosPerIssue.values()).reduce((s, v) => s + v, 0)
    }

    const dedupeTwStats = (monthIndices: number[]): TwMonthStats => {
      const allSet = new Set<string>(); const ndSet = new Set<string>()
      const rvSet = new Set<string>(); const oaSet = new Set<string>()
      const crSet = new Set<string>(); const agSet = new Set<string>()
      const retMap = new Map<string, number>()
      for (const m of monthIndices) {
        const cb = buckets[m]!
        for (const k of cb.all) allSet.add(k)
        for (const k of cb.novasDocs) ndSet.add(k)
        for (const k of cb.revisoes) rvSet.add(k)
        for (const k of cb.outrasAtividades) oaSet.add(k)
        for (const k of cb.criticos) crSet.add(k)
        for (const k of cb.ag) agSet.add(k)
        for (const [k, v] of cb.retornosPerIssue) retMap.set(k, Math.max(retMap.get(k) ?? 0, v))
      }
      return {
        totalSeconds: monthIndices.reduce((s, m) => s + (combined[m]?.totalSeconds ?? 0), 0),
        investimentoCentavos: monthIndices.reduce((s, m) => s + (combined[m]?.investimentoCentavos ?? 0), 0),
        totalIssues: allSet.size, novasDocs: ndSet.size, revisoes: rvSet.size,
        outrasAtividades: oaSet.size, criticos: crSet.size, aguardando: agSet.size,
        retornos: Array.from(retMap.values()).reduce((s, v) => s + v, 0),
      }
    }

    const quarterDedupeStats: TwMonthStats[] = QUARTERS.map(q => dedupeTwStats(q.months))
    const periodTotalRow = dedupeTwStats(activeMonths)

    // Entries from active months only (for yearTotals seconds and distribByTag)
    const anchoredEntries = allEntries.filter(e => {
      const m = new Date(`${e.started.slice(0, 10)}T12:00:00`).getMonth()
      return activeMonths.includes(m)
    })

    let novasDocsSeconds = 0, revisoesSeconds = 0, outrasAtividadesSeconds = 0
    for (const e of anchoredEntries) {
      const tf = issueCanonicalType.get(e.issueKey) ?? ""
      const s = e.timeSpentSeconds
      if (tf === "new documentation") novasDocsSeconds += s
      else if (tf === "documentation review") revisoesSeconds += s
      else outrasAtividadesSeconds += s
    }
    const yTotals: TwYearTotals = {
      novasDocs: periodTotalRow.novasDocs, revisoes: periodTotalRow.revisoes,
      outrasAtividades: periodTotalRow.outrasAtividades, criticos: periodTotalRow.criticos,
      aguardando: periodTotalRow.aguardando, retornos: periodTotalRow.retornos,
      novasDocsSeconds, revisoesSeconds, outrasAtividadesSeconds,
    }

    const tagDistribMap = new Map<string, Set<string>>()
    for (const e of anchoredEntries) {
      const tag = e.tag?.trim() || "Sem tag"
      if (!tagDistribMap.has(tag)) tagDistribMap.set(tag, new Set())
      tagDistribMap.get(tag)!.add(e.issueKey)
    }

    const periodTagInvestment = (tag: string): number =>
      activeMonths.reduce((s, m) => s + (tagMonthInvestmentMap.get(tag)?.[m] ?? 0), 0)

    const toTagItems = (m: Map<string, Set<string>>) =>
      [...m.entries()]
        .map(([tag, keys]) => ({ tag, count: keys.size, investimentoCentavos: periodTagInvestment(tag) }))
        .sort((a, b) => b.count - a.count)

    // Merge Jira IDs from email-resolved memberJiraIds (activeApprovalJiraIds) and from actual
    // worklog entries (activeJiraAccountIds) so filtering works even when the email lookup failed.
    const effectiveApprovalJiraIds = new Set([...activeApprovalJiraIds, ...activeJiraAccountIds])
    const approvalIssuesForMember = effectiveApprovalJiraIds.size > 0 && selectedUserIds.length > 0
      ? liveApprovalIssues.filter(
          (i) => i.assigneeAccountId != null && effectiveApprovalJiraIds.has(i.assigneeAccountId),
        )
      : liveApprovalIssues

    const approvalTagMap = new Map<string, number>()
    for (const i of approvalIssuesForMember) {
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

  // Limpar seleções que não são mais visíveis (ex.: mudança de ano ou desligamento)
  React.useEffect(() => {
    const visibleIds = new Set(visibleMembros.map((m) => m.userId))
    setSelectedUserIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [visibleMembros])

  // ── Derived totals for metric cards (period-scoped) ──────────────────────
  const totalAnual = React.useMemo(
    () => activeMonths.reduce((acc, m) => sumTwStats(acc, (monthStats ?? [])[m] ?? emptyTwMonthStats()), emptyTwMonthStats()),
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
          getApprovalIssuesByTag("TW"),
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
          label="Total de Críticos"
          value={loading ? "—" : String(yearTotals.criticos)}
          icon={AlertTriangle}
          iconVariant="warning"
          sparkData={loading ? undefined : sparkCriticos}
          sparkFormatter={(v) => `${v} crítico${v !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Metric cards — linha 2: Novas Documentações, Revisões, Outras Atividades, Retornos */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <TypeCard
            label="Novas Documentações"
            count={yearTotals.novasDocs}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={yearTotals.novasDocsSeconds}
            hideValues={hideValues}
            tint="blue"
          />
          <TypeCard
            label="Revisões"
            count={yearTotals.revisoes}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={yearTotals.revisoesSeconds}
            hideValues={hideValues}
            tint="blue"
          />
          <TypeCard
            label="Outras Atividades"
            count={yearTotals.outrasAtividades}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={yearTotals.outrasAtividadesSeconds}
            hideValues={hideValues}
            tint="blue"
          />
          <TypeCard
            label="Retornos"
            count={yearTotals.retornos}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            timeSpentSeconds={0}
            hideValues={hideValues}
            tint="warning"
          />
        </div>
      )}

      {/* Tag breakdown charts */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <TagBarChart
              title="Jiras por Produto"
              items={distribByTag}
              ariaLabel="Distribuição de jiras por produto"
              hideValues={hideValues}
              totalCount={distribByTag.reduce((s, i) => s + i.count, 0)}
            />
          </div>
          <div className="lg:col-span-1">
            <TagPieChart
              title="Atividades em Aprovação"
              items={approvalByTag}
              ariaLabel="Documentações em aprovação por tag"
              totalCount={approvalByTag.reduce((s, i) => s + i.count, 0)}
            />
          </div>
        </div>
      )}

      {/* Yearly table */}
      {loading || monthStats === null ? (
        <SectionSpinner minHeight="min-h-[300px]" />
      ) : (
        <TwYearTable monthStats={monthStats} hideValues={hideValues} ano={ano} activeMonths={activeMonths} quarterDedupeStats={quarterDedupeStats} periodTotalRow={periodTotalRow} />
      )}
    </div>
  )
}
