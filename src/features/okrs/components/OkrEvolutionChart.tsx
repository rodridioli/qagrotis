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

const MES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

interface OkrEvolutionChartProps {
  okr: OkrDetailDto
}

export function OkrEvolutionChart({ okr }: OkrEvolutionChartProps) {
  const allKrs = okr.objetivos.flatMap((o) => o.keyResults).filter((kr) => kr.situacao === "ATIVO" && kr.evolucao.length > 0)

  // Monta série por mês para cada KR
  const allMonths = new Set<string>()
  for (const kr of allKrs) {
    for (const e of kr.evolucao) {
      allMonths.add(`${e.ano}-${String(e.mes).padStart(2, "0")}`)
    }
  }
  const sortedMonths = [...allMonths].sort()

  const data = sortedMonths.map((ym) => {
    const [ano, mesStr] = ym.split("-")
    const mes = parseInt(mesStr ?? "1", 10)
    const label = MES_LABELS[mes - 1] ?? mesStr
    const point: Record<string, unknown> = { name: label }
    for (const kr of allKrs) {
      const evo = kr.evolucao.find((e) => e.ano === parseInt(ano ?? "2026", 10) && e.mes === mes)
      const pct = evo !== undefined && kr.meta > 0 ? Math.min((evo.valor / kr.meta) * 100, 100) : null
      point[kr.id] = pct !== null ? Number(pct.toFixed(1)) : undefined
    }
    return point
  })

  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Evolução Mensal (%)</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`]}
            contentStyle={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {allKrs.map((kr, idx) => (
            <Line
              key={kr.id}
              type="monotone"
              dataKey={kr.id}
              name={kr.descricao.slice(0, 30) + (kr.descricao.length > 30 ? "…" : "")}
              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
