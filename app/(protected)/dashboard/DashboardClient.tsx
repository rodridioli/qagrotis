"use client"

import { useMemo } from "react"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import { DashboardCharts } from "./DashboardCharts"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { QaUserRecord } from "@/lib/actions/usuarios"
import type { SuiteRecord } from "@/lib/actions/suites"

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
  allSuites: SuiteRecord[]
  currentUser: string | null
  currentUserPhotoPath: string | null
}

export function DashboardClient({ allCenarios, allModulos, allUsers, allSuites, currentUser, currentUserPhotoPath }: Props) {
  const { sistemaSelecionado } = useSistemaSelecionado()

  // Maps both name and email to a user's display name and photo
  const userMap = useMemo(() => {
    const map = new Map<string, { displayName: string; photoPath: string | null }>()
    for (const u of allUsers) {
      if (u.name) map.set(u.name, { displayName: u.name, photoPath: u.photoPath ?? null })
      if (u.email) map.set(u.email, { displayName: u.name, photoPath: u.photoPath ?? null })
    }
    if (currentUser && currentUserPhotoPath) {
      map.set(currentUser, { displayName: currentUser, photoPath: currentUserPhotoPath })
    }
    return map
  }, [allUsers, currentUser, currentUserPhotoPath])

  function resolveUser(createdBy: string | undefined): { displayName: string; photoPath: string | null } {
    if (!createdBy) return { displayName: "Desconhecido", photoPath: null }
    const found = userMap.get(createdBy)
    if (found) return found
    // If createdBy looks like an email, try to strip domain to get initials
    if (createdBy.includes("@")) {
      const localPart = createdBy.split("@")[0]
      const name = localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      return { displayName: name, photoPath: null }
    }
    return { displayName: createdBy, photoPath: null }
  }

  const {
    totalModulos, totalCenarios, totalManuais, totalAutomatizados,
    pctManuais, pctAuto, automationData,
    rankingHoje, ultimasAutomacoes,
  } = useMemo(() => {
    const modsFiltrados = allModulos.filter(
      (m) => (!sistemaSelecionado || m.sistemaName === sistemaSelecionado)
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

    // Automation coverage per module
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

    // Ranking today: count scenarios created today per user
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayTs = todayStart.getTime()

    const countByUser = new Map<string, number>()
    for (const c of cenariosFiltrados) {
      if ((c.createdAt ?? 0) >= todayTs) {
        const key = c.createdBy ?? "Desconhecido"
        countByUser.set(key, (countByUser.get(key) ?? 0) + 1)
      }
    }
    const rankingHoje = [...countByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([createdBy, count]) => ({ createdBy, count }))

    // Last 4 automated scenarios
    const ultimasAutomacoes = cenariosFiltrados
      .filter((c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto.")
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        scenarioName: c.scenarioName,
        descricao: c.descricao ?? "",
        createdAt: c.createdAt ?? null,
        createdBy: c.createdBy,
        module: c.module,
      }))

    return {
      totalModulos, totalCenarios, totalManuais, totalAutomatizados,
      pctManuais, pctAuto, automationData,
      rankingHoje, ultimasAutomacoes,
    }
  }, [allCenarios, allModulos, sistemaSelecionado])

  const { monthlyTests, monthlyErrors } = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        tests: 0,
        errors: 0,
      }
    })
    const sixMonthsAgoTs = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime()
    for (const suite of allSuites) {
      for (const h of suite.historico ?? []) {
        const ts = h.timestamp
        if (!ts || ts < sixMonthsAgoTs) continue
        const d = new Date(ts)
        const idx = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()) + 5
        if (idx < 0 || idx > 5) continue
        months[idx].tests++
        if (h.resultado === "Erro") months[idx].errors++
      }
    }
    return {
      monthlyTests: months.map(m => ({ month: m.month, value: m.tests })),
      monthlyErrors: months.map(m => ({ month: m.month, value: m.errors })),
    }
  }, [allSuites])

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
        monthlyTests={monthlyTests}
        monthlyErrors={monthlyErrors}
        rankingHoje={rankingHoje}
        ultimasAutomacoes={ultimasAutomacoes}
        resolveUser={resolveUser}
      />
    </div>
  )
}
