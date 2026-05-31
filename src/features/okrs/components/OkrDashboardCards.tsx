"use client"

import type { OkrDetailDto } from "@/features/okrs/lib/okrs-schemas"

function stat(value: number | string, label: string, sub?: string) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card px-4 py-3 shadow-card">
      <p className="text-2xl font-bold tabular-nums text-text-primary">{value}</p>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
    </div>
  )
}

interface OkrDashboardCardsProps {
  okr: OkrDetailDto
}

export function OkrDashboardCards({ okr }: OkrDashboardCardsProps) {
  const allObjetivos = okr.objetivos
  const ativos = allObjetivos.filter((o) => o.situacao === "ATIVO")
  const cancelados = allObjetivos.filter((o) => o.situacao === "CANCELADO")

  const allKrs = allObjetivos.flatMap((o) => o.keyResults)
  const krsAtivos = allKrs.filter((kr) => kr.situacao === "ATIVO")
  const krsEmRisco = krsAtivos.filter((kr) => kr.risco === "EM_RISCO" || kr.risco === "CRITICO")
  const krsCancelados = allKrs.filter((kr) => kr.situacao === "CANCELADO")

  const progressoTotal =
    krsAtivos.length > 0
      ? krsAtivos.reduce((acc, kr) => acc + kr.progressoPercent, 0) / krsAtivos.length
      : 0

  const pctEmRisco = krsAtivos.length > 0 ? (krsEmRisco.length / krsAtivos.length) * 100 : 0
  const pctCancelados = allKrs.length > 0 ? (krsCancelados.length / allKrs.length) * 100 : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stat(allObjetivos.length, "Objetivos")}
      {stat(allKrs.length, "Resultados-chave")}
      {stat(`${progressoTotal.toFixed(0)}%`, "% Conclusão")}
      {stat(`${pctEmRisco.toFixed(0)}%`, "% Em Risco")}
      {stat(`${pctCancelados.toFixed(0)}%`, "% Cancelados")}
    </div>
  )
}
