"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
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
  moduloNames:       string[]
  rankingData:       RankingItem[]
  rankingFilter:     RankingFilter
  onRankingFilterChange: (v: RankingFilter) => void
  rankingModulo:     string
  onRankingModuloChange: (v: string) => void
  testesData:        DataPoint[]
  testesFilter:      TestesFilter
  onTestesFilterChange: (v: TestesFilter) => void
  testesModulo:      string
  onTestesModuloChange: (v: string) => void
  errosData:         DataPoint[]
  errosFilter:       ChartFilter
  onErrosFilterChange: (v: ChartFilter) => void
  errosModulo:       string
  onErrosModuloChange: (v: string) => void
  sucessoData:       DataPoint[]
  sucessoFilter:     ChartFilter
  onSucessoFilterChange: (v: ChartFilter) => void
  sucessoModulo:     string
  onSucessoModuloChange: (v: string) => void
  ultimasAutomacoes: UltimaAutomacao[]
  resolveUser: (createdBy: string | undefined) => { displayName: string; photoPath: string | null }
  cenariosPorModulo: { name: string; value: number }[]
}

// ── Filter options ─────────────────────────────────────────────────────────────

const RANKING_OPTS: { value: RankingFilter; label: string }[] = [
  { value: "hoje",         label: "Hoje" },
  { value: "semana",       label: "Última semana" },
  { value: "mes-atual",    label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-atual",    label: "Ano" },
]

const TESTES_OPTS: { value: TestesFilter; label: string }[] = [
  { value: "hoje",         label: "Hoje" },
  { value: "semana",       label: "Última semana" },
  { value: "mes-atual",    label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-atual",    label: "Ano" },
]

const CHART_OPTS: { value: ChartFilter; label: string }[] = [
  { value: "hoje",         label: "Hoje" },
  { value: "semana",       label: "Última semana" },
  { value: "mes-atual",    label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "ano-atual",    label: "Ano" },
]

// ── Pie chart colors ──────────────────────────────────────────────────────────

const PIE_COLORS = [
  "var(--brand-primary)",
  "#6366f1",
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
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
      <SelectTrigger className="h-8 max-w-[110px] shrink-0 text-xs" aria-label={label ?? "Filtrar por período"}>
        <SelectValue>{options.find(o => o.value === value)?.label ?? "Hoje"}</SelectValue>
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
  "bg-blue-100 text-blue-700 font-bold",
  "bg-purple-100 text-purple-700 font-bold",
  "bg-amber-100 text-amber-700 font-bold",
  "bg-green-100 text-green-700 font-bold",
  "bg-rose-100 text-rose-700 font-bold",
]

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--surface-card)",
  color: "var(--text-primary)",
}

const TICK_X_AXIS = { fontSize: 11, fill: "var(--qagrotis-primary-600)" }

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
    <div className="relative shrink-0 flex items-center justify-center">
      {photoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic user URLs + custom onError fallback to initials
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
        className={`${sz} ${textSz} rounded-full items-center justify-center ${AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]}`}
        style={{ display: photoPath ? "none" : "flex" }}
      >
        {getInitials(displayName)}
      </div>
    </div>
  )
}

// ── ModuloSelect ──────────────────────────────────────────────────────────────

function ModuloSelect({
  modulos,
  value,
  onChange,
}: {
  modulos: string[]
  value: string
  onChange: (v: string) => void
}) {
  if (modulos.length === 0) return null
  return (
    <Select value={value || "__todos__"} onValueChange={(v) => { if (v) onChange(v === "__todos__" ? "" : v) }}>
      <SelectTrigger className="h-8 max-w-[130px] shrink-0 text-xs" aria-label="Filtrar por módulo">
        <SelectValue>{value ? value : "Todos"}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        <SelectItem value="__todos__">Todos</SelectItem>
        {modulos.map(m => (
          <SelectItem key={m} value={m}>{m}</SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function DashboardCharts({
  automationData,
  moduloNames,
  rankingData,   rankingFilter,  onRankingFilterChange,  rankingModulo,  onRankingModuloChange,
  testesData,    testesFilter,   onTestesFilterChange,   testesModulo,   onTestesModuloChange,
  errosData,     errosFilter,    onErrosFilterChange,    errosModulo,    onErrosModuloChange,
  sucessoData,   sucessoFilter,  onSucessoFilterChange,  sucessoModulo,  onSucessoModuloChange,
  ultimasAutomacoes, resolveUser,
  cenariosPorModulo,
}: Props) {
  const totalExecucoes = testesData.reduce((acc, d) => acc + d.value, 0)
  const totalErros = errosData.reduce((acc, d) => acc + d.value, 0)
  const totalSucesso = sucessoData.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="space-y-4">

      {/* Row 1 — Ranking + Cobertura de automação */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Cenários gerados */}
        <div className="flex flex-col rounded-xl bg-surface-card p-5 shadow-card min-h-75">
          <div className="mb-4 flex flex-nowrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-text-primary">
              Cenários gerados
            </h2>
            <div className="flex-1" />
            <ModuloSelect modulos={moduloNames} value={rankingModulo} onChange={onRankingModuloChange} />
            <FilterSelect<RankingFilter>
              options={RANKING_OPTS}
              value={rankingFilter}
              onChange={onRankingFilterChange}
              label="Filtro período ranking"
            />
          </div>

          {rankingData.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-secondary">Nenhum cenário gerado no período.</p>
          ) : (
            <div className="mt-1 overflow-hidden">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b border-border-default/50 text-[10px] font-bold uppercase tracking-wider text-text-secondary/70">
                     <th className="pb-2 pr-2 font-bold">Pos</th>
                     <th className="pb-2 font-bold px-2">Usuário</th>
                     <th className="pb-2 text-right font-bold">Total</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border-default/30">
                   {rankingData.map((item, i) => {
                     const { displayName, photoPath } = resolveUser(item.createdBy)
                     const isTop1 = i === 0
                     const posLabel = isTop1 ? "1°" : i === 1 ? "2°" : i === 2 ? "3°" : `${i + 1}°`
                     
                     return (
                       <tr key={item.createdBy} className="group transition-colors hover:bg-neutral-grey-50/50">
                         <td className="py-2.5 pr-2">
                           <span className={cn(
                             "inline-flex size-6 items-center justify-center rounded-md text-[10px] font-bold",
                             isTop1 ? "bg-brand-primary text-white" : "bg-neutral-grey-100 text-text-secondary"
                           )}>
                             {posLabel}
                           </span>
                         </td>
                         <td className="py-2.5 px-2">
                           <div className="flex items-center gap-2.5 min-w-0">
                             <Avatar displayName={displayName} photoPath={photoPath} colorIndex={i} size="sm" />
                             <span className="truncate text-xs font-medium text-text-primary group-hover:text-brand-primary transition-colors">
                               {displayName}
                             </span>
                           </div>
                         </td>
                         <td className="py-2.5 text-right">
                           <span className="text-xs font-bold text-text-primary">
                             {item.count}
                           </span>
                         </td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
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

      {/* Row 2 — Testes executados + Cenários por Módulo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Testes executados */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-3">
          <div className="mb-4 flex flex-nowrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-text-primary">
              Testes executados: <span className="text-brand-primary">{totalExecucoes.toLocaleString("pt-BR")}</span>
            </h2>
            <div className="flex-1" />
            <ModuloSelect modulos={moduloNames} value={testesModulo} onChange={onTestesModuloChange} />
            <FilterSelect<TestesFilter>
              options={TESTES_OPTS}
              value={testesFilter}
              onChange={onTestesFilterChange}
              label="Filtro período testes"
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
              <XAxis dataKey="label" tick={TICK_X_AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "Execuções"]} />
              <Area type="monotone" dataKey="value" stroke="var(--qagrotis-primary-500)" strokeWidth={2} fill="url(#testsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cenários por Módulo — pie chart */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Cenários por Módulo</h2>
          {cenariosPorModulo.length === 0 ? (
            <p className="text-xs text-text-secondary">Nenhum cenário cadastrado para o sistema selecionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={cenariosPorModulo}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {cenariosPorModulo.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, _n, props) => [
                    `${v} cenário${Number(v) !== 1 ? "s" : ""}`,
                    props.payload?.name ?? "",
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {value.length > 18 ? value.slice(0, 17) + "…" : value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3 — Erros + Sucesso */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Erros encontrados */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <div className="mb-4 flex flex-nowrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-text-primary">
              Erros encontrados: <span className="text-destructive">{totalErros.toLocaleString("pt-BR")}</span>
            </h2>
            <div className="flex-1" />
            <ModuloSelect modulos={moduloNames} value={errosModulo} onChange={onErrosModuloChange} />
            <FilterSelect<ChartFilter>
              options={CHART_OPTS}
              value={errosFilter}
              onChange={onErrosFilterChange}
              label="Filtro período erros"
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
              <XAxis dataKey="label" tick={TICK_X_AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "Erros"]} />
              <Area type="monotone" dataKey="value" stroke="var(--color-red-500)" strokeWidth={2} fill="url(#errorsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Testes de sucesso */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <div className="mb-4 flex flex-nowrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-text-primary">
              Testes de sucesso: <span className="text-qagrotis-primary-500">{totalSucesso.toLocaleString("pt-BR")}</span>
            </h2>
            <div className="flex-1" />
            <ModuloSelect modulos={moduloNames} value={sucessoModulo} onChange={onSucessoModuloChange} />
            <FilterSelect<ChartFilter>
              options={CHART_OPTS}
              value={sucessoFilter}
              onChange={onSucessoFilterChange}
              label="Filtro período sucesso"
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
              <XAxis dataKey="label" tick={TICK_X_AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "Sucessos"]} />
              <Area type="monotone" dataKey="value" stroke="var(--qagrotis-primary-500)" strokeWidth={2} fill="url(#successGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 — Últimas automações */}
      <div className="rounded-xl bg-surface-card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Últimas automações</h2>
        {ultimasAutomacoes.length === 0 ? (
          <p className="text-xs text-text-secondary">Nenhum cenário automatizado cadastrado.</p>
        ) : (
          <UltimasAutomacoesPaginado items={ultimasAutomacoes} resolveUser={resolveUser} />
        )}
      </div>

    </div>
  )
}

// ── Últimas automações com paginação ─────────────────────────────────────────

const ITEMS_PER_PAGE = 2

function UltimasAutomacoesPaginado({
  items,
  resolveUser,
}: {
  items: UltimaAutomacao[]
  resolveUser: (createdBy: string | undefined) => { displayName: string; photoPath: string | null }
}) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE)
  const pageItems = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

  return (
    <div className="space-y-3">
      {pageItems.map((item, i) => {
        const globalIndex = page * ITEMS_PER_PAGE + i
        const { displayName, photoPath } = resolveUser(item.createdBy)
        return (
          <div key={item.id} className="rounded-lg border border-border-default p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Avatar displayName={displayName} photoPath={photoPath} colorIndex={globalIndex} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{displayName}</p>
                <p className="text-xs text-text-secondary/70">{formatDateTime(item.createdAt)}</p>
              </div>
            </div>
            <div>
              <Link
                href={`/cenarios/${item.id}/editar`}
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-text-secondary">
            {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex size-7 items-center justify-center rounded-md border border-border-default text-text-secondary transition-colors hover:bg-neutral-grey-100 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="flex size-7 items-center justify-center rounded-md border border-border-default text-text-secondary transition-colors hover:bg-neutral-grey-100 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
