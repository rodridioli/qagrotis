"use client"

import * as React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { OkrDetailDto, OkrKeyResultDto } from "@/features/okrs/lib/okrs-schemas"

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
]

const MES_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12],
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Interpola linearmente entre pontos mensais para um dado timestamp
function interpolate(
  points: Array<{ ts: number; val: number }>,
  ts: number,
): number | null {
  if (points.length === 0) return null
  if (ts < points[0]!.ts) return 0          // antes do primeiro dado: parte de 0
  if (ts >= points[points.length - 1]!.ts) return points[points.length - 1]!.val

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    if (ts >= p0.ts && ts <= p1.ts) {
      const t = (ts - p0.ts) / (p1.ts - p0.ts)
      return p0.val + t * (p1.val - p0.val)
    }
  }
  return null
}

// Monta pontos mensais de um KR (posicionados no último dia de cada mês)
function buildKrAnchors(
  kr: OkrKeyResultDto,
  ano: number,
  months: number[],
): Array<{ ts: number; val: number }> {
  const anchors: Array<{ ts: number; val: number }> = []
  for (const m of months) {
    const evo = kr.evolucao.find((e) => e.ano === ano && e.mes === m)
    if (evo !== undefined) {
      const pct = kr.meta > 0 ? Math.min((evo.valor / kr.meta) * 100, 100) : 0
      const lastDay = getDaysInMonth(ano, m)
      anchors.push({ ts: new Date(ano, m - 1, lastDay).getTime(), val: pct })
    }
  }
  return anchors
}

interface OkrEvolutionChartProps {
  okr: OkrDetailDto
}

export function OkrEvolutionChart({ okr }: OkrEvolutionChartProps) {
  const months = QUARTER_MONTHS[okr.periodo] ?? [1, 2, 3]
  const ano = okr.ano

  // Gera todos os dias do trimestre
  const allDays: Date[] = []
  for (const m of months) {
    const daysInMonth = getDaysInMonth(ano, m)
    for (let d = 1; d <= daysInMonth; d++) {
      allDays.push(new Date(ano, m - 1, d))
    }
  }

  // Limita ao dia atual (não projeta o futuro)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const visibleDays = allDays.filter((d) => d <= today)
  if (visibleDays.length === 0) return null

  // Objetivos ativos com pelo menos um KR ativo
  const activeObjetivos = okr.objetivos.filter(
    (o) => o.situacao === "ATIVO" && o.keyResults.some((kr) => kr.situacao === "ATIVO"),
  )
  if (activeObjetivos.length === 0) return null

  // Para cada objetivo: monta linha diária como média dos KRs ativos interpolados
  const objectiveSeries = activeObjetivos.map((obj) => {
    const activeKrs = obj.keyResults.filter((kr) => kr.situacao === "ATIVO")
    const krAnchors = activeKrs.map((kr) => buildKrAnchors(kr, ano, months))

    const dailyValues = new Map<number, number>()
    for (const day of visibleDays) {
      const ts = day.getTime()
      const vals: number[] = []
      for (const anchors of krAnchors) {
        if (anchors.length === 0) continue
        const v = interpolate(anchors, ts)
        if (v !== null) vals.push(v)
      }
      if (vals.length > 0) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        dailyValues.set(ts, Number(avg.toFixed(1)))
      }
    }
    return dailyValues
  })

  // Monta array de pontos para o Recharts
  const data = visibleDays.map((day) => {
    const ts = day.getTime()
    const point: Record<string, unknown> = { ts }
    for (let i = 0; i < activeObjetivos.length; i++) {
      const obj = activeObjetivos[i]!
      point[obj.id] = objectiveSeries[i]!.get(ts)
    }
    return point
  })

  // Ticks do eixo X: 1º de cada mês visível
  const xTicks = months
    .map((m) => new Date(ano, m - 1, 1).getTime())
    .filter((ts) => ts <= today.getTime())

  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        Evolução Diária do Trimestre (%)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={xTicks}
            tickFormatter={(ts: number) => {
              const d = new Date(ts)
              return `1 ${MES_ABBR[d.getMonth()] ?? ""}`
            }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(ts: number) => {
              const d = new Date(ts)
              return `${d.getDate()} ${MES_ABBR[d.getMonth()] ?? ""}`
            }}
            formatter={(value: number, _: string, entry: { name?: string }) => [
              `${value.toFixed(1)}%`,
              entry.name ?? "",
            ]}
            contentStyle={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {activeObjetivos.map((obj, idx) => (
            <Line
              key={obj.id}
              type="monotone"
              dataKey={obj.id}
              name={obj.descricao.length > 40 ? `${obj.descricao.slice(0, 40)}…` : obj.descricao}
              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
