"use client"

import Link from "next/link"
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

interface AutomationDataPoint { module: string; coverage: number }
interface MonthlyDataPoint    { month: string;  value: number    }

interface RankingItem {
  createdBy: string
  count: number
}

interface UltimaAutomacao {
  id: string
  scenarioName: string
  descricao: string
  createdAt: number | null
  createdBy: string | undefined
  module: string
}

interface Props {
  automationData:   AutomationDataPoint[]
  monthlyTests:     MonthlyDataPoint[]
  monthlyErrors:    MonthlyDataPoint[]
  rankingHoje:      RankingItem[]
  ultimasAutomacoes: UltimaAutomacao[]
  resolveUser: (createdBy: string | undefined) => { displayName: string; photoPath: string | null }
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
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
}

interface AvatarProps {
  displayName: string
  photoPath: string | null
  colorIndex: number
  size?: "sm" | "md"
}

function Avatar({ displayName, photoPath, colorIndex, size = "md" }: AvatarProps) {
  const sz = size === "sm" ? "size-6" : "size-8"
  const textSz = size === "sm" ? "text-[10px]" : "text-xs"
  return (
    <div className="relative shrink-0">
      {photoPath ? (
        <img
          src={photoPath}
          alt={displayName}
          className={`${sz} rounded-full object-cover`}
          onError={(e) => {
            e.currentTarget.style.display = "none"
            const sibling = e.currentTarget.nextElementSibling as HTMLElement | null
            if (sibling) sibling.style.display = "flex"
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

export function DashboardCharts({
  automationData, monthlyTests, monthlyErrors,
  rankingHoje, ultimasAutomacoes, resolveUser,
}: Props) {
  return (
    <div className="space-y-4">

      {/* Row 1 — Ranking gerados hoje + Cobertura de automação */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Cenários gerados hoje — ranking por usuário */}
        <div className="flex flex-col rounded-xl bg-surface-card p-5 shadow-card min-h-[300px]">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Cenários gerados hoje</h2>
          {rankingHoje.length === 0 ? (
            <p className="text-xs text-text-secondary">Nenhum cenário gerado hoje.</p>
          ) : (
            <div className="space-y-2.5">
              {rankingHoje.map((item, i) => {
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

        {/* Cobertura de automação — ocupa toda a altura disponível */}
        <div className="col-span-1 flex flex-col rounded-xl bg-surface-card p-5 shadow-card md:col-span-2 min-h-[300px]">
          <h2 className="mb-4 shrink-0 text-sm font-semibold text-text-primary">Cobertura de automação por módulo</h2>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={automationData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="module" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "transparent" }} formatter={(v) => [`${v}%`, "Cobertura"]} />
                <Bar dataKey="coverage" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 — Testes por mês + Últimas automações */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Testes executados por mês */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Testes executados por mês</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyTests} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="testsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--qagrotis-primary-500)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--qagrotis-primary-500)" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="value" stroke="var(--qagrotis-primary-500)" strokeWidth={2} fill="url(#testsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Últimas automações — 4 mais recentes */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Últimas automações</h2>
          {ultimasAutomacoes.length === 0 ? (
            <p className="text-xs text-text-secondary">Nenhum cenário automatizado cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {ultimasAutomacoes.map((item, i) => {
                const { displayName, photoPath } = resolveUser(item.createdBy)
                return (
                  <div key={item.id} className="rounded-lg border border-border-default p-3 space-y-2">
                    {/* Author + date */}
                    <div className="flex items-center gap-2">
                      <Avatar displayName={displayName} photoPath={photoPath} colorIndex={i} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text-primary">{displayName}</p>
                        <p className="text-xs text-text-secondary/70">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                    {/* Code (link) + description */}
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

      {/* Row 3 — Erros por mês (full width) */}
      <div className="rounded-xl bg-surface-card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Erros encontrados por mês</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyErrors} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-red-500)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-red-500)" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-red-500)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke="var(--color-red-500)" strokeWidth={2} fill="url(#errorsGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
