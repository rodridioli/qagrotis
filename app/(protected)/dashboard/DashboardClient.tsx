"use client"

import { useMemo } from "react"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import {
  MONTHLY_TESTS_DATA,
  MONTHLY_ERRORS_DATA,
} from "@/lib/qagrotis-constants"
import { DashboardCharts } from "./DashboardCharts"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { QaUserRecord } from "@/lib/actions/usuarios"

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
  allUsers: QaUserRecord[]
  currentUser: string | null
  currentUserPhotoPath: string | null
}

function buildUserRanking(
  cenarios: CenarioRecord[],
  currentUser: string | null,
  photoMap: Map<string, string | null>,
  filterFn?: (c: CenarioRecord) => boolean
) {
  const counts = new Map<string, number>()
  for (const c of cenarios) {
    if (filterFn && !filterFn(c)) continue
    const user = c.createdBy ?? currentUser ?? "Não identificado"
    counts.set(user, (counts.get(user) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total, photoPath: photoMap.get(name) ?? null }))
}

export function DashboardClient({ allCenarios, allModulos, allUsers, currentUser, currentUserPhotoPath }: Props) {
  const { sistemaSelecionado } = useSistemaSelecionado()

  const photoMap = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const u of allUsers) {
      if (u.photoPath) map.set(u.name, u.photoPath)
    }
    // Also map the current session user's name (may differ from profile name) to their photo
    if (currentUser && currentUserPhotoPath) {
      map.set(currentUser, currentUserPhotoPath)
    }
    return map
  }, [allUsers, currentUser, currentUserPhotoPath])

  const { totalModulos, totalCenarios, totalManuais, totalAutomatizados, pctManuais, pctAuto, automationData, filaFiltrada, rankingGeral, rankingAutomacao } = useMemo(() => {
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

    // Últimas automações — last automated cenários
    const filaFiltrada = cenariosFiltrados
      .filter((c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto.")
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 8)
      .map((c) => ({ id: c.id, module: c.module, title: c.scenarioName, priority: c.risco ?? "Média" }))

    // Ranking: all cenários by user (cadastrados ou alterados)
    const rankingGeral = buildUserRanking(cenariosFiltrados, currentUser, photoMap)

    // Ranking: automated cenários by user
    const rankingAutomacao = buildUserRanking(
      cenariosFiltrados,
      currentUser,
      photoMap,
      (c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto."
    )

    return { totalModulos, totalCenarios, totalManuais, totalAutomatizados, pctManuais, pctAuto, automationData, filaFiltrada, rankingGeral, rankingAutomacao }
  }, [allCenarios, allModulos, sistemaSelecionado, currentUser, photoMap])

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
        rankingGeral={rankingGeral}
        rankingAutomacao={rankingAutomacao}
      />
    </div>
  )
}
