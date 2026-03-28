"use client"

import { useMemo } from "react"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import {
  MONTHLY_TESTS_DATA,
  MONTHLY_ERRORS_DATA,
  ULTIMAS_TAREFAS,
} from "@/lib/qagrotis-constants"
import { DashboardCharts } from "./DashboardCharts"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"

function MetricCard({
  label,
  value,
  percentage,
}: {
  label: string
  value: string
  percentage?: string
}) {
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {percentage && (
        <p className="mt-1 text-xs text-text-secondary">{percentage}</p>
      )}
    </div>
  )
}

interface Props {
  allCenarios: CenarioRecord[]
  allModulos: ModuloRecord[]
}

export function DashboardClient({ allCenarios, allModulos }: Props) {
  const { sistemaSelecionado } = useSistemaSelecionado()

  const { totalModulos, totalCenarios, totalManuais, totalAutomatizados, pctManuais, pctAuto, automationData, filaFiltrada } = useMemo(() => {
    const modsFiltrados = allModulos.filter(
      (m) => m.active && (!sistemaSelecionado || m.sistemaName === sistemaSelecionado)
    )
    const totalModulos = modsFiltrados.length

    const cenariosFiltrados = allCenarios.filter(
      (c) => c.active && (!sistemaSelecionado || c.system === sistemaSelecionado)
    )
    const totalCenarios = cenariosFiltrados.length
    const totalManuais = cenariosFiltrados.filter((c) => c.tipo === "Manual").length
    const totalAutomatizados = cenariosFiltrados.filter(
      (c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto."
    ).length
    const pctManuais = totalCenarios > 0 ? Math.round((totalManuais / totalCenarios) * 100) : 0
    const pctAuto = totalCenarios > 0 ? Math.round((totalAutomatizados / totalCenarios) * 100) : 0

    // Automation coverage per module — derived from real cenários
    const modNames = modsFiltrados.map((m) => m.name)
    const automationData = modNames.length > 0
      ? modNames.map((mod) => {
          const cenariosDoModulo = cenariosFiltrados.filter((c) => c.module === mod)
          const total = cenariosDoModulo.length
          const auto = cenariosDoModulo.filter(
            (c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto."
          ).length
          return { module: mod, coverage: total > 0 ? Math.round((auto / total) * 100) : 0 }
        })
      : []

    // Fila de automação — last automated cenários (Automatizado or Man./Auto.)
    const filaFiltrada = cenariosFiltrados
      .filter((c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto.")
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 8)
      .map((c) => ({ id: c.id, module: c.module, title: c.scenarioName, priority: c.risco ?? "Média" }))

    return { totalModulos, totalCenarios, totalManuais, totalAutomatizados, pctManuais, pctAuto, automationData, filaFiltrada }
  }, [allCenarios, allModulos, sistemaSelecionado])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Módulos" value={String(totalModulos)} />
        <MetricCard label="Total de cenários" value={totalCenarios.toLocaleString("pt-BR")} />
        <MetricCard label="Manuais" value={totalManuais.toLocaleString("pt-BR")} percentage={`${pctManuais}%`} />
        <MetricCard label="Automatizados" value={totalAutomatizados.toLocaleString("pt-BR")} percentage={`${pctAuto}%`} />
      </div>

      <DashboardCharts
        automationData={automationData}
        monthlyTests={MONTHLY_TESTS_DATA}
        monthlyErrors={MONTHLY_ERRORS_DATA}
        filaAutomacao={filaFiltrada}
        ultimasTarefas={ULTIMAS_TAREFAS}
      />
    </div>
  )
}
