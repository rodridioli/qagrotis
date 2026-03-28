"use client"

import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { PriorityBadge } from "@/components/qagrotis/StatusBadge"

interface AutomationDataPoint { module: string; coverage: number }
interface MonthlyDataPoint    { month: string;  value: number    }
interface FilaItem            { id: string; module: string; title: string; priority: string }
interface RankingItem         { name: string; total: number; photoPath?: string | null }

interface Props {
  automationData:   AutomationDataPoint[]
  monthlyTests:     MonthlyDataPoint[]
  monthlyErrors:    MonthlyDataPoint[]
  filaAutomacao:    FilaItem[]
  rankingGeral:     RankingItem[]
  rankingAutomacao: RankingItem[]
}


function getInitials(name: string): string {
  return name.split(/[\s@]/).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
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

export function DashboardCharts({
  automationData, monthlyTests, monthlyErrors, filaAutomacao, rankingGeral, rankingAutomacao,
}: Props) {
  return (
    <div className="space-y-4">

      {/* Row 1 — Cenários gerados + Cobertura de automação */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Cenários gerados — ranking por usuário */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Cenários gerados</h2>
          {rankingGeral.length === 0 ? (
            <p className="text-xs text-text-secondary">Nenhum cenário cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {rankingGeral.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  {item.photoPath ? (
                    <img
                      src={item.photoPath}
                      alt={item.name}
                      className="size-8 shrink-0 rounded-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = "none"
                        el.nextElementSibling?.removeAttribute("style")
                      }}
                    />
                  ) : null}
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                    style={item.photoPath ? { display: "none" } : undefined}
                  >
                    {getInitials(item.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-secondary">{item.total} cenário{item.total !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-text-secondary">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cobertura de automação */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card md:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Cobertura de automação por módulo</h2>
          <ResponsiveContainer width="100%" height={220}>
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

        {/* Últimas automações */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Últimas automações</h2>

          {/* Ranking de usuários com mais cenários automatizados */}
          {rankingAutomacao.length > 0 && (
            <div className="mb-3 space-y-1.5 border-b border-border-default pb-3">
              {rankingAutomacao.slice(0, 3).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-text-secondary w-4 shrink-0">#{i + 1}</span>
                    {item.photoPath ? (
                      <img
                        src={item.photoPath}
                        alt={item.name}
                        className="size-6 shrink-0 rounded-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget
                          el.style.display = "none"
                          el.nextElementSibling?.removeAttribute("style")
                        }}
                      />
                    ) : null}
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                      style={item.photoPath ? { display: "none" } : undefined}
                    >
                      {getInitials(item.name)}
                    </div>
                    <span className="truncate text-xs text-text-primary">{item.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-text-secondary">{item.total}</span>
                </div>
              ))}
            </div>
          )}

          {/* Lista de últimos cenários automatizados */}
          <div className="space-y-2">
            {filaAutomacao.length === 0 ? (
              <p className="text-xs text-text-secondary">Nenhum cenário automatizado cadastrado.</p>
            ) : (
              filaAutomacao.map((item) => (
                <div key={item.id} className="rounded-lg border border-border-default p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">{item.id}</span>
                    <span className="text-xs text-text-secondary">{item.module}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-text-primary">{item.title}</p>
                    <PriorityBadge priority={item.priority} />
                  </div>
                </div>
              ))
            )}
          </div>
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
