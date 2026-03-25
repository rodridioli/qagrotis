"use client"

import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

interface AutomationDataPoint { module: string; coverage: number }
interface MonthlyDataPoint    { month: string;  value: number    }
interface FilaItem            { id: string; module: string; title: string; priority: string }
interface TarefaItem          { name: string; execucoes: string; avatarColor: string }

interface Props {
  automationData:  AutomationDataPoint[]
  monthlyTests:    MonthlyDataPoint[]
  monthlyErrors:   MonthlyDataPoint[]
  filaAutomacao:   FilaItem[]
  ultimasTarefas:  TarefaItem[]
}

function PriorityBadge({ priority }: { priority: string }) {
  const isCritical = priority === "Crítica"
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      isCritical ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
    }`}>
      {priority}
    </span>
  )
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--surface-card)",
}

export function DashboardCharts({
  automationData, monthlyTests, monthlyErrors, filaAutomacao, ultimasTarefas,
}: Props) {
  return (
    <div className="space-y-4">

      {/* Row 1 — Últimas tarefas + Cobertura de automação */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Últimas tarefas */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Últimas tarefas</h2>
          <div className="space-y-4">
            {ultimasTarefas.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${t.avatarColor} text-xs font-semibold text-text-primary`}>
                  {getInitials(t.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-secondary">{t.execucoes}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cobertura de automação */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card md:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Cobertura de automação por módulo</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={automationData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="module" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Cobertura"]} />
              <Bar dataKey="coverage" fill="var(--qagrotis-primary-500)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2 — Testes por mês + Fila de Automação */}
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

        {/* Fila de Automação */}
        <div className="col-span-1 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Fila de Automação</h2>
          <div className="space-y-2">
            {filaAutomacao.map((item) => (
              <div key={item.id} className="rounded-lg border border-border-default p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">ID: {item.id}</span>
                  <span className="text-xs text-text-secondary">Módulo: {item.module}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-text-primary">{item.title}</p>
                  <PriorityBadge priority={item.priority} />
                </div>
              </div>
            ))}
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
