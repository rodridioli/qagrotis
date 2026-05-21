"use client"

import * as React from "react"
import { AlertTriangle, BarChart2, Clock, Eye, EyeOff, RefreshCw, TrendingUp } from "lucide-react"
import { AreaChart, Area, ResponsiveContainer, XAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts"
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
  /** Histórico completo de progressão por userId, ordenado por data DESC. */
  progressaoMap: Record<string, ProgressaoHistoricoEntry[]>
}

interface JiraEntry {
  issueKey: string
  projectName?: string | null
  typeField?: string | null
  status?: string | null
  priority?: string | null
  retornos?: number
  retornosByAssignee?: Record<string, number>
  authorJiraAccountId?: string | null
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
}

function aggregateYearTotals(entries: JiraEntry[], filterAccountId?: string): YearTypeTotals {
  const novosProto = new Set<string>()
  const melhorias = new Set<string>()
  const ajustes = new Set<string>()
  const pesq = new Set<string>()
  const usab = new Set<string>()
  const criticos = new Set<string>()
  let outros = new Set<string>()
  const ag = new Set<string>()
  // retornos: sum per unique issue (take the max value seen for each key)
  const retornosPerIssue = new Map<string, number>()

  for (const e of entries) {
    const tf = (e.typeField ?? "").trim().toLowerCase()
    if (tf === "new/redesign" || tf === "new" || tf === "redesign") novosProto.add(e.issueKey)
    if (tf === "improvement") melhorias.add(e.issueKey)
    if (tf === "ajust/return" || tf === "adjustment/return") ajustes.add(e.issueKey)
    if (tf === "research") pesq.add(e.issueKey)
    if (tf === "usability") usab.add(e.issueKey)
    if (tf === "others" || tf === "other") outros.add(e.issueKey)
    if (e.priority?.toLowerCase().trim() === "critical") criticos.add(e.issueKey)
    if (e.status?.toLowerCase().trim() === "approval") ag.add(e.issueKey)
    const r = filterAccountId
      ? ((e.retornosByAssignee?.[filterAccountId] ?? 0))
      : (e.retornos ?? 0)
    if (r > 0) {
      retornosPerIssue.set(e.issueKey, Math.max(retornosPerIssue.get(e.issueKey) ?? 0, r))
    }
  }

  // Merge untyped issues (not in any known type bucket) into "outros"
  const typedIssues = new Set([...novosProto, ...melhorias, ...ajustes, ...pesq, ...usab, ...outros])
  for (const e of entries) {
    if (!typedIssues.has(e.issueKey)) outros.add(e.issueKey)
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
  }
}

function aggregateByMonth(
  entries: JiraEntry[],
  progressaoHistory: ProgressaoHistoricoEntry[],
  year: number,
): MonthStats[] {
  type Bucket = {
    seconds: number
    all: Set<string>
    novosProto: Set<string>
    melhorias: Set<string>
    ajustes: Set<string>
    pesq: Set<string>
    usabilidade: Set<string>
    criticos: Set<string>
    outros: Set<string>
    ag: Set<string>
    retornosPerIssue: Map<string, number>
  }
  const byMonth: Map<number, Bucket> = new Map()
  for (let i = 0; i < 12; i++) {
    byMonth.set(i, {
      seconds: 0,
      all: new Set(),
      novosProto: new Set(),
      melhorias: new Set(),
      ajustes: new Set(),
      pesq: new Set(),
      usabilidade: new Set(),
      criticos: new Set(),
      outros: new Set(),
      ag: new Set(),
      retornosPerIssue: new Map(),
    })
  }

  for (const e of entries) {
    const datePart = e.started.slice(0, 10)
    const month = new Date(`${datePart}T12:00:00`).getMonth()
    if (month < 0 || month > 11) continue
    const bucket = byMonth.get(month)!
    bucket.seconds += e.timeSpentSeconds
    bucket.all.add(e.issueKey)
    const tf = (e.typeField ?? "").trim().toLowerCase()
    if (tf === "new/redesign" || tf === "new" || tf === "redesign") bucket.novosProto.add(e.issueKey)
    if (tf === "improvement") bucket.melhorias.add(e.issueKey)
    if (tf === "ajust/return" || tf === "adjustment/return") bucket.ajustes.add(e.issueKey)
    if (tf === "research") bucket.pesq.add(e.issueKey)
    if (tf === "usability") bucket.usabilidade.add(e.issueKey)
    if (tf === "others" || tf === "other") bucket.outros.add(e.issueKey)
    if (e.priority?.toLowerCase().trim() === "critical") bucket.criticos.add(e.issueKey)
    if (e.status?.toLowerCase().trim() === "approval") bucket.ag.add(e.issueKey)
    const r = e.retornos ?? 0
    if (r > 0) {
      bucket.retornosPerIssue.set(
        e.issueKey,
        Math.max(bucket.retornosPerIssue.get(e.issueKey) ?? 0, r),
      )
    }
  }

  // Merge untyped issues (not in any known type bucket) into "outros" per month
  for (const bucket of byMonth.values()) {
    const typedInMonth = new Set([
      ...bucket.novosProto, ...bucket.melhorias, ...bucket.ajustes,
      ...bucket.pesq, ...bucket.usabilidade, ...bucket.outros,
    ])
    for (const key of bucket.all) {
      if (!typedInMonth.has(key)) bucket.outros.add(key)
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const bucket = byMonth.get(i)!
    const hours = bucket.seconds / 3600
    const valorHora = getValorHoraForMonth(progressaoHistory, year, i)
    const investimento = valorHora != null ? Math.round(hours * valorHora) : 0
    return {
      totalSeconds: bucket.seconds,
      totalIssues: bucket.all.size,
      novosPrototipos: bucket.novosProto.size,
      melhorias: bucket.melhorias.size,
      ajustes: bucket.ajustes.size,
      pesquisa: bucket.pesq.size,
      usabilidade: bucket.usabilidade.size,
      criticos: bucket.criticos.size,
      outros: bucket.outros.size,
      aguardando: bucket.ag.size,
      retornos: Array.from(bucket.retornosPerIssue.values()).reduce((s, v) => s + v, 0),
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
          return (
            <Tooltip key={m.userId}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${m.name}${isSelected ? " (selecionado)" : ""}`}
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
                <UserAvatar name={m.name} photoPath={m.photoPath} size={AVATAR_STRIP_SIZE} />
              </TooltipTrigger>
              <TooltipContent>{m.name}</TooltipContent>
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
  const colorMap: Record<string, string> = {
    brand: "#3b82f6",
    success: "#22c55e",
    warning: "#f59e0b",
    info: "#06b6d4",
  }
  const color = colorMap[variant] ?? "#3b82f6"
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
          tick={{ fontSize: 9, fill: "#94a3b8" }}
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
  const iconCls = cn(
    "hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg",
    iconVariant === "brand"   && "bg-brand-primary/10 text-brand-primary",
    iconVariant === "warning" && "bg-badge-warning/10 text-badge-warning-text",
    iconVariant === "success" && "bg-badge-success/10 text-badge-success-text",
    iconVariant === "info"    && "bg-badge-info/10 text-badge-info-text",
  )
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
        <div className={iconCls}>
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

// YearTable is fully additive: quarterly row = sum of its months, total row = sum of all months.
// Each unique issue can appear in multiple months if it had worklogs in multiple months,
// so quarterly/annual sums may exceed the global unique count shown in the cards.
// Cards use global Sets (true unique) — table uses per-period activity counts.
function YearTable({ monthStats, hideValues }: { monthStats: MonthStats[]; hideValues: boolean }) {
  const totalAnual = monthStats.reduce(sumStats, emptyMonthStats())
  const inv = (v: number) =>
    hideValues ? <span className="tracking-widest text-text-disabled">••••</span> : formatBRL(v)

  const TH = ({ children }: { children: React.ReactNode }) => (
    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
      {children}
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Trimestre
            </th>
            <TH>Horas</TH>
            <TH>Investimento</TH>
            <TH>Jiras</TH>
            <TH>Protótipos</TH>
            <TH>Pesquisas</TH>
            <TH>Usabilidade</TH>
            <TH>Outros</TH>
            <TH>Novos</TH>
            <TH>Melhorias</TH>
            <TH>Ajustes</TH>
            <TH>Retornos</TH>
            <TH>Aguardando</TH>
          </tr>
        </thead>
        <tbody>
          {QUARTERS.map((q) => {
            // All values summed additively — quarterly = sum of its months
            const qStats = q.months.reduce(
              (acc, mi) => sumStats(acc, monthStats[mi]!),
              emptyMonthStats(),
            )
            return (
              <React.Fragment key={q.label}>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{q.label}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{formatHHMM(qStats.totalSeconds)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{inv(qStats.investimentoCentavos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.totalIssues}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.novosPrototipos + qStats.melhorias + qStats.ajustes}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.pesquisa}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.usabilidade}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.outros}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.novosPrototipos}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.melhorias}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.ajustes}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.retornos}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{qStats.aguardando}</td>
                </tr>
                {q.months.map((mi) => {
                  const ms = monthStats[mi]!
                  return (
                    <tr
                      key={mi}
                      className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/50"
                    >
                      <td className="px-4 py-2 pl-8 text-text-secondary">{MONTHS_PT[mi]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{formatHHMM(ms.totalSeconds)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{inv(ms.investimentoCentavos)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.totalIssues}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.novosPrototipos + ms.melhorias + ms.ajustes}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.pesquisa}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.usabilidade}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.outros}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.novosPrototipos}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.melhorias}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.ajustes}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.retornos}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">{ms.aguardando}</td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}

          <tr className="border-t-2 border-border-default bg-neutral-grey-50">
            <td className="px-4 py-2.5 font-bold text-text-primary">Total</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{formatHHMM(totalAnual.totalSeconds)}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{inv(totalAnual.investimentoCentavos)}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.totalIssues}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.novosPrototipos + totalAnual.melhorias + totalAnual.ajustes}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.pesquisa}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.usabilidade}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.outros}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.novosPrototipos}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.melhorias}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.ajustes}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.retornos}</td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-text-primary">{totalAnual.aguardando}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── TypeCard ─────────────────────────────────────────────────────────────────

function TypeCard({
  label,
  count,
  totalIssues,
  totalInvestimentoCentavos,
  hideValues,
}: {
  label: string
  count: number
  totalIssues: number
  totalInvestimentoCentavos: number
  hideValues: boolean
}) {
  const pct = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0
  const costCentavos = totalIssues > 0
    ? Math.round((count / totalIssues) * totalInvestimentoCentavos)
    : 0
  return (
    <div className="rounded-xl bg-surface-card p-4 shadow-card">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{count}</p>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-text-secondary">
        <span className="tabular-nums">{pct}%</span>
        <span className="text-border-default">·</span>
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

export function UxDashboardClient({ membros, progressaoMap }: Props) {
  const currentYear = new Date().getFullYear()
  const [ano, setAno] = React.useState(currentYear)
  const [loading, setLoading] = React.useState(false)
  const [hideValues, setHideValues] = React.useState(true)
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
  const { monthStats, totalUniqueIssues, yearTotals, protoByProduct, agByProduct } = React.useMemo(() => {
    const empty: YearTypeTotals = {
      novosPrototipos: 0, melhorias: 0, ajustes: 0, pesquisa: 0,
      usabilidade: 0, criticos: 0, outros: 0, aguardando: 0, retornos: 0,
    }
    if (Object.keys(rawMemberEntries).length === 0) {
      return {
        monthStats: null,
        totalUniqueIssues: 0,
        yearTotals: empty,
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

    // When exactly one user is selected, filter retornos by their Jira accountId
    let filterAccountId: string | undefined
    if (activeMembers.length === 1) {
      const memberId = activeMembers[0]!.userId
      const firstEntry = (rawMemberEntries[memberId] ?? []).find((e) => e.authorJiraAccountId)
      filterAccountId = firstEntry?.authorJiraAccountId ?? undefined
    }

    // Year-level unique counts for the cards (global Sets — true unique, no double-counting)
    const yTotals = aggregateYearTotals(allEntries, filterAccountId)

    const protoMap = new Map<string, Set<string>>()
    const agMap = new Map<string, Set<string>>()
    for (const e of allEntries) {
      const tf = (e.typeField ?? "").trim().toLowerCase()
      const proj = e.projectName?.trim() || e.issueKey.split("-")[0] || "Outros"
      if (tf === "new/redesign" || tf === "new" || tf === "redesign") {
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
      yearTotals: yTotals,
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

  // ── Sparkline arrays (month-by-month trend, 12 points) ────────────────────
  const sparkJiras    = (monthStats ?? []).map(ms => ms.totalIssues)
  const sparkCriticos = (monthStats ?? []).map(ms => ms.criticos)
  const sparkTempo    = (monthStats ?? []).map(ms =>
    ms.totalIssues > 0 ? Math.round(ms.totalSeconds / ms.totalIssues) : 0)
  const sparkValor    = (monthStats ?? []).map(ms =>
    ms.totalIssues > 0 && avgValorHora != null
      ? Math.round(avgValorHora * (ms.totalSeconds / ms.totalIssues / 3600))
      : 0)

  // ── Fetch all members on year change (uses cache) ─────────────────────────
  const fetchAll = React.useCallback(
    async (year: number, force = false) => {
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

  // ── Render ───────────────────────────────────────────────────────────────
  const hasSelection = selectedUserIds.length > 0

  return (
    <div className="min-w-0 space-y-6">
      {/* Avatar strip + year selector na mesma linha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {membros.length > 0 && (
            <UxAvatarStrip
              membros={membros}
              selectedUserIds={selectedUserIds}
              onToggle={toggleUser}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={String(ano)}
            onValueChange={(v) => { if (v) setAno(Number(v)) }}
          >
            <SelectTrigger
              className="h-8 w-auto text-xs"
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
          <button
            type="button"
            aria-label="Sincronizar dados"
            disabled={loading}
            onClick={() => void fetchAll(ano, true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface-card text-text-secondary shadow-sm transition-colors hover:bg-neutral-grey-50 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={hideValues ? "Exibir valores monetários" : "Ocultar valores monetários"}
            onClick={() => setHideValues((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface-card text-text-secondary shadow-sm transition-colors hover:bg-neutral-grey-50 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {hideValues ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Metric cards — linha 1 (4 cards com sparkline) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Tempo Médio por Atividade"
          value={loading ? "—" : formatDurationAvg(avgSecondsPerIssue)}
          icon={Clock}
          iconVariant="brand"
          sparkData={loading ? undefined : sparkTempo}
          sparkFormatter={formatDurationAvg}
        />
        <MetricCard
          label="Valor Médio por Atividade"
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

      {/* Metric cards — linha 2: Protótipos, Pesquisas, Usabilidade, Outros, Novos, Melhorias, Ajustes, Retornos */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <TypeCard
            label="Protótipos"
            count={yearTotals.novosPrototipos + yearTotals.melhorias + yearTotals.ajustes}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Pesquisas"
            count={yearTotals.pesquisa}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Usabilidade"
            count={yearTotals.usabilidade}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Outros"
            count={yearTotals.outros}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Novos"
            count={yearTotals.novosPrototipos}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Melhorias"
            count={yearTotals.melhorias}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Ajustes"
            count={yearTotals.ajustes}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
          <TypeCard
            label="Retornos"
            count={yearTotals.retornos}
            totalIssues={totalUniqueIssues}
            totalInvestimentoCentavos={totalAnual.investimentoCentavos}
            hideValues={hideValues}
          />
        </div>
      )}

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
        <YearTable monthStats={monthStats} hideValues={hideValues} />
      )}
    </div>
  )
}
