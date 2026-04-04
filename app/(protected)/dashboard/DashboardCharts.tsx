"use client"

import Link from "next/link"
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import type {
  RankingFilter, TestesFilter, ChartFilter,
  DataPoint, RankingItem,
} from "./DashboardClient"

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomationDataPoint { module: string; coverage: number }

interface UltimaAutomacao {
  id: string
  scenarioName: string
  descricao: string
  createdAt: number | null
  createdBy: string | undefined
  module: string
}

interface Props {
  automationData:    AutomationDataPoint[]
  rankingData:       RankingItem[]
  rankingFilter:     RankingFilter
  onRankingFilterChange: (v: RankingFilter) => void
  testesData:        DataPoint[]
  testesFilter:      TestesFilter
  onTestesFilterChange: (v: TestesFilter) => void
  errosData:         DataPoint[]
  errosFilter:       ChartFilter
  onErrosFilterChange: (v: ChartFilter) => void
  sucessoData:       DataPoint[]
  sucessoFilter:     ChartFilter
  onSucessoFilterChange: (v: ChartFilter) => void
  ultimasAutomacoes: UltimaAutomacao[]
  resolveUser: (createdBy: string | undefined) => { displayName: string; photoPath: string | null }
}

// ── Filter options ─────────────────────────────────────────────────────────────

const RANKING_OPTS: { value: RankingFilter; label: string }[] = [
  { value: "hoje",         label: "Hoje" },
  { value: "semana",       label: "Última semana" },
  { value: "mes-atual",    label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-atual",    label: "Ano atual" },
]

const TESTES_OPTS: { value: TestesFilter; label: string }[] = [
  { value: "hoje",         label: "Hoje" },
  { value: "semana",       label: "Última semana" },
  { value: "mes-atual",    label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-atual",    label: "Ano atual" },
]

const CHART_OPTS: { value: ChartFilter; label: string }[] = [
  { value: "hoje",         label: "Hoje" },
  { value: "semana",       label: "Última semana" },
  { value: "mes-atual",    label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-atual",    label: "Ano atual" },
]

// ── FilterSelect ───────────────────────────────────────────────────────────────

function FilterSelect<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v as T) }}>
      <SelectTrigger className="h-8 min-w-20 shrink-0 text-xs" aria-label={label ?? "Filtrar por período"}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MAX_TICK_CHARS = 14

function TruncatedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload) return null
  const label = payload.value.length > MAX_TICK_CHARS
    ? payload.value.slice(0, MAX_TICK_CHARS) + "…"
    : payload.value
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={0} y={0} dy={10} textAnchor="end" fill="var(--text-secondary)" fontSize={10} transform="rotate(-35)">
        {label}
      </text>
    </g>
  )
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase()
}

function formatDateTime(ts: number | null): string {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-green-100 text-green-700",
  "bg-rose-100 text-rose-700",
]

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--surface-card)",
  color: "var(--text-primary)",
}

function Avatar({
  displayName,
  photoPath,
  colorIndex,
  size = "md",
}: {
  displayName: string
  photoPath: string | null
  colorIndex: number
  size?: "sm" | "md"
}) {
  const sz = size === "sm" ? "size-6" : "size-8"
  const textSz = size === "sm" ? "text-[10px]" : "text-xs"
  return (
    <div className="relative shrink-0">
      {photoPath ? (
        <img
          src={photoPath}
          alt={displayName}
          className={`${sz} rounded-full object-cover`}
          onError={e => {
            e.currentTarget.style.display = "none"
            const sib = e.currentTarget.nextElementSibling as HTMLElement | null
            if (sib) sib.style.display = "flex"
          }}
        />
      ) : null}
      <div
        className={`${sz} ${textSz} font-semibold rounded-full items-center justify-center ${AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]}`}
        style={{ display: photoPath ? "none" : "flex" }}
      >
        {getInitials(displayName)}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function DashboardCharts({
  automationData,
  rankingData, rankingFilter, onRankingFilterChange,
  testesData,  testesFilter,  onTestesFilterChange,
  errosData,   errosFilter,   onErrosFilterChange,
  sucessoData, sucessoFilter, onSucessoFilterChange,
  ultimasAutomacoes, resolveUser,
}: Props) {
  return (
    <div className="space-y-4">

      {/* Row 1 — Ranking + Cobertura de automação */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Ranking */}
        <div className="flex flex-col rounded-xl bg-surface-card p-5 shadow-card min-h-75">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold text-text-primary">
              Ranking de geração
            </h2>
            <FilterSelect<RankingFilter>
              options={RANKING_OPTS}
              value={rankingFilter}
              onChange={onRankingFilterChange}
              label="Filtro ranking"
            />
          </div>

          {rankingData.length === 0 ? (
            <p className="text-xs text-text-secondary">Nenhum cenário gerado no período.</p>
          ) : (
            <div className="space-y-2.5">
              {rankingData.map((item, i) => {
                const { displayName, photoPath } = resolveUser(item.createdBy)
                const posLabel = i === 0 ? "1°" : i === 1 ? "2°" : i === 2 ? "3°" : `${i + 1}°`
                const posColor = i === 0
                  ? "text-brand-primary font-bold"
                  : i === 1
                  ? "text-text-secondary font-semibold"
                  : "text-text-secondary"
                return (
                  <div key={item.createdBy} className="flex items-center gap-3">
                    <span className={`w-5 shrink-0 text-center text-xs ${posColor}`}>{posLabel}</span>
                    <Avatar displayName={displayName} photoPath={photoPath} colorIndex={i} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-sm text-text-primary">{displayName}</p>
                    <span className="shrink-0 rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                      {item.count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cobertura de automação */}
        <div className="col-span-1 flex flex-col rounded-xl bg-surface-card p-5 shadow-card md:col-span-2 min-h-75">
          <h2 className="mb-4 shrink-0 text-sm font-semibold text-text-primary">
            Cobertura de automação por módulo
          </h2>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={automationData} margin={{ top: 0, right: 0, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="module" tick={<TruncatedTick />} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "transparent" }} formatter={v => [`${v}%`, "Cobertura"]} />
                <Bar dataKey="coverage" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 — Testes executados + Últimas automações */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Testes executados */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold text-text-primary">Testes executados</h2>
            <FilterSelect<TestesFilter>
              options={TESTES_OPTS}
              value={testesFilter}
              onChange={onTestesFilterChange}
              label="Filtro testes"
            />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={testesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="testsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--qagrotis-primary-500)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--qagrotis-primary-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "Execuções"]} />
              <Area type="monotone" dataKey="value" stroke="var(--qagrotis-primary-500)" strokeWidth={2} fill="url(#testsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Últimas automações */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Últimas automações</h2>
          {ultimasAutomacoes.length === 0 ? (
            <p className="text-xs text-text-secondary">Nenhum cenário automatizado cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {ultimasAutomacoes.slice(0, 2).map((item, i) => {
                const { displayName, photoPath } = resolveUser(item.createdBy)
                return (
                  <div key={item.id} className="rounded-lg border border-border-default p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar displayName={displayName} photoPath={photoPath} colorIndex={i} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text-primary">{displayName}</p>
                        <p className="text-xs text-text-secondary/70">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                    <div>
                      <Link
                        href={`/cenarios/${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs font-semibold text-brand-primary hover:underline"
                      >
                        {item.id}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-text-primary">{item.scenarioName}</p>
                      {item.descricao && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{item.descricao}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Erros + Sucesso */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Erros encontrados */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold text-text-primary">Erros encontrados</h2>
            <FilterSelect<ChartFilter>
              options={CHART_OPTS}
              value={errosFilter}
              onChange={onErrosFilterChange}
              label="Filtro erros"
            />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={errosData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-red-500)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-red-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-red-500)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "Erros"]} />
              <Area type="monotone" dataKey="value" stroke="var(--color-red-500)" strokeWidth={2} fill="url(#errorsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Testes de sucesso */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold text-text-primary">Testes de sucesso</h2>
            <FilterSelect<ChartFilter>
              options={CHART_OPTS}
              value={sucessoFilter}
              onChange={onSucessoFilterChange}
              label="Filtro sucesso"
            />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sucessoData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--qagrotis-primary-500)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--qagrotis-primary-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--qagrotis-primary-600)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "Sucessos"]} />
              <Area type="monotone" dataKey="value" stroke="var(--qagrotis-primary-500)" strokeWidth={2} fill="url(#successGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
