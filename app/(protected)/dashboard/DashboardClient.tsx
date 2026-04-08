"use client"

import React, { useMemo, useState } from "react"
import { Layers, FileText, ClipboardList, Cpu } from "lucide-react"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import { DashboardCharts } from "./DashboardCharts"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { QaUserRecord } from "@/lib/actions/usuarios"
import type { SuiteDashboardRecord } from "@/lib/actions/suites"

// ── Types ─────────────────────────────────────────────────────────────────────

export type RankingFilter = "hoje" | "semana" | "mes-atual" | "mes-anterior" | "ano-atual"
export type TestesFilter  = "hoje" | "semana" | "mes-atual" | "mes-anterior" | "ano-atual"
export type ChartFilter   = "hoje" | "semana" | "mes-atual" | "mes-anterior" | "ano-atual"
export interface DataPoint  { label: string; value: number }
export interface RankingItem { createdBy: string; count: number }

interface UltimaAutomacao {
  id: string
  scenarioName: string
  descricao: string
  createdAt: number | null
  createdBy: string | undefined
  module: string
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDateRange(period: string): { start: number; end: number } {
  const now = new Date()
  switch (period) {
    case "hoje": {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { start: s.getTime(), end: s.getTime() + 86400000 - 1 }
    }
    case "semana": {
      const s = new Date(now)
      s.setDate(now.getDate() - 6)
      s.setHours(0, 0, 0, 0)
      return { start: s.getTime(), end: now.getTime() }
    }
    case "mes-atual": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start: s.getTime(), end: e.getTime() }
    }
    case "mes-anterior": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { start: s.getTime(), end: e.getTime() }
    }
    case "ano-atual": {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: s.getTime(), end: now.getTime() }
    }
    default:
      return { start: 0, end: now.getTime() }
  }
}

function makeBuckets(period: string): { label: string; start: number; end: number }[] {
  const now = new Date()
  if (period === "hoje") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Array.from({ length: 24 }, (_, i) => {
      const s = new Date(today); s.setHours(i, 0, 0, 0)
      const e = new Date(today); e.setHours(i, 59, 59, 999)
      return { label: `${i}h`, start: s.getTime(), end: e.getTime() }
    }).filter(b => b.start <= now.getTime())
  }
  if (period === "semana") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - 6 + i)
      d.setHours(0, 0, 0, 0)
      const e = new Date(d); e.setHours(23, 59, 59, 999)
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }).replace(".", "")
      return { label, start: d.getTime(), end: e.getTime() }
    })
  }
  if (period === "mes-atual") {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
      const e = new Date(now.getFullYear(), now.getMonth(), i + 1, 23, 59, 59, 999)
      return { label: String(i + 1), start: d.getTime(), end: e.getTime() }
    })
  }
  if (period === "mes-anterior") {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const days = new Date(y, m + 1, 0).getDate()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(y, m, i + 1)
      const e = new Date(y, m, i + 1, 23, 59, 59, 999)
      return { label: String(i + 1), start: d.getTime(), end: e.getTime() }
    })
  }
  // ano-atual
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1)
    const e = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59, 999)
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
    return { label, start: d.getTime(), end: e.getTime() }
  })
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  percentage,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string
  percentage?: string
  icon: React.ElementType
  iconColor: string
}) {
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
          {percentage && (
            <p className="mt-1 text-xs text-text-secondary">{percentage}</p>
          )}
        </div>
        <div
          className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconColor + "1a" }}
        >
          <Icon className="size-5" style={{ color: iconColor }} aria-hidden />
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  allCenarios: CenarioRecord[]
  allModulos: ModuloRecord[]
  allUsers: QaUserRecord[]
  allSuites: SuiteDashboardRecord[]
  currentUser: string | null
  currentUserPhotoPath: string | null
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  allCenarios,
  allModulos,
  allUsers,
  allSuites,
  currentUser,
  currentUserPhotoPath,
}: Props) {
  const { sistemaSelecionado } = useSistemaSelecionado()

  // ── Filter states ──────────────────────────────────────────────────────────
  const [rankingFilter, setRankingFilter] = useState<RankingFilter>("hoje")
  const [testesFilter,  setTestesFilter]  = useState<TestesFilter>("hoje")
  const [errosFilter,   setErrosFilter]   = useState<ChartFilter>("hoje")
  const [sucessoFilter, setSucessoFilter] = useState<ChartFilter>("hoje")

  // ── User map ───────────────────────────────────────────────────────────────
  const userMap = useMemo(() => {
    const map = new Map<string, { displayName: string; photoPath: string | null }>()
    for (const u of allUsers) {
      if (u.name)  map.set(u.name,  { displayName: u.name,  photoPath: u.photoPath ?? null })
      if (u.email) map.set(u.email, { displayName: u.name,  photoPath: u.photoPath ?? null })
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
    if (createdBy.includes("@")) {
      const name = createdBy.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      return { displayName: name, photoPath: null }
    }
    return { displayName: createdBy, photoPath: null }
  }

  // ── Cenários filtrados ─────────────────────────────────────────────────────
  const {
    totalModulos, totalCenarios, totalManuais, totalAutomatizados,
    pctManuais, pctAuto, automationData, ultimasAutomacoes, cenariosFiltrados,
  } = useMemo(() => {
    const modsFiltrados = allModulos.filter(
      m => !sistemaSelecionado || m.sistemaName === sistemaSelecionado
    )
    const totalModulos = modsFiltrados.length

    const cenariosFiltrados = allCenarios.filter(
      c => c.active && (!sistemaSelecionado || c.system === sistemaSelecionado)
    )
    const totalCenarios = cenariosFiltrados.length
    const totalManuais = cenariosFiltrados.filter(c => c.tipo === "Manual").length
    const totalAutomatizados = cenariosFiltrados.filter(
      c => c.tipo === "Automatizado" || c.tipo === "Man./Auto."
    ).length
    const pctManuais = totalCenarios > 0 ? Math.round((totalManuais / totalCenarios) * 100) : 0
    const pctAuto    = totalCenarios > 0 ? Math.round((totalAutomatizados / totalCenarios) * 100) : 0

    const automationData = modsFiltrados.map(m => {
      const cenariosDoMod = cenariosFiltrados.filter(c => c.module === m.name)
      const total = cenariosDoMod.length
      const auto  = cenariosDoMod.filter(c => c.tipo === "Automatizado" || c.tipo === "Man./Auto.").length
      return { module: m.name, coverage: total > 0 ? Math.round((auto / total) * 100) : 0 }
    })

    const ultimasAutomacoes: UltimaAutomacao[] = cenariosFiltrados
      .filter(c => c.tipo === "Automatizado" || c.tipo === "Man./Auto.")
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 4)
      .map(c => ({
        id: c.id,
        scenarioName: c.scenarioName,
        descricao: c.descricao ?? "",
        createdAt: c.createdAt ?? null,
        createdBy: c.createdBy,
        module: c.module,
      }))

    return {
      totalModulos, totalCenarios, totalManuais, totalAutomatizados,
      pctManuais, pctAuto, automationData, ultimasAutomacoes, cenariosFiltrados,
    }
  }, [allCenarios, allModulos, sistemaSelecionado])

  // ── Suites filtradas ───────────────────────────────────────────────────────
  const suitesFiltradas = useMemo(() =>
    allSuites.filter(s => !sistemaSelecionado || s.sistema === sistemaSelecionado),
    [allSuites, sistemaSelecionado]
  )

  // ── Historico entries (flat) ───────────────────────────────────────────────
  const historicoEntries = useMemo(() => {
    const entries: { timestamp: number; resultado: string }[] = []
    for (const suite of suitesFiltradas) {
      for (const h of suite.historico ?? []) {
        if (h.timestamp) entries.push({ timestamp: h.timestamp, resultado: h.resultado })
      }
    }
    return entries
  }, [suitesFiltradas])

  // ── Ranking ────────────────────────────────────────────────────────────────
  const rankingData = useMemo((): RankingItem[] => {
    const { start, end } = getDateRange(rankingFilter)
    const countByUser = new Map<string, number>()
    for (const c of cenariosFiltrados) {
      const ts = c.createdAt ?? 0
      if (ts >= start && ts <= end) {
        const key = c.createdBy ?? "Desconhecido"
        countByUser.set(key, (countByUser.get(key) ?? 0) + 1)
      }
    }
    return [...countByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([createdBy, count]) => ({ createdBy, count }))
  }, [cenariosFiltrados, rankingFilter])

  // ── Testes chart ───────────────────────────────────────────────────────────
  const testesData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(testesFilter)
    return buckets.map(b => ({
      label: b.label,
      value: historicoEntries.filter(e => e.timestamp >= b.start && e.timestamp <= b.end).length,
    }))
  }, [historicoEntries, testesFilter])

  // ── Erros chart ────────────────────────────────────────────────────────────
  const errosData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(errosFilter)
    return buckets.map(b => ({
      label: b.label,
      value: historicoEntries.filter(
        e => e.timestamp >= b.start && e.timestamp <= b.end && e.resultado === "Erro"
      ).length,
    }))
  }, [historicoEntries, errosFilter])

  // ── Sucesso chart ──────────────────────────────────────────────────────────
  const sucessoData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(sucessoFilter)
    return buckets.map(b => ({
      label: b.label,
      value: historicoEntries.filter(
        e => e.timestamp >= b.start && e.timestamp <= b.end && e.resultado === "Sucesso"
      ).length,
    }))
  }, [historicoEntries, sucessoFilter])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Módulos"           value={String(totalModulos)}                        icon={Layers}        iconColor="#00735D" />
        <MetricCard label="Total de cenários" value={totalCenarios.toLocaleString("pt-BR")}      icon={FileText}      iconColor="#6366f1" />
        <MetricCard label="Manuais"           value={totalManuais.toLocaleString("pt-BR")}       icon={ClipboardList} iconColor="#f59e0b" percentage={`${pctManuais}%`} />
        <MetricCard label="Automatizados"     value={totalAutomatizados.toLocaleString("pt-BR")} icon={Cpu}           iconColor="#0ea5e9" percentage={`${pctAuto}%`} />
      </div>

      <DashboardCharts
        automationData={automationData}
        rankingData={rankingData}
        rankingFilter={rankingFilter}
        onRankingFilterChange={setRankingFilter}
        testesData={testesData}
        testesFilter={testesFilter}
        onTestesFilterChange={setTestesFilter}
        errosData={errosData}
        errosFilter={errosFilter}
        onErrosFilterChange={setErrosFilter}
        sucessoData={sucessoData}
        sucessoFilter={sucessoFilter}
        onSucessoFilterChange={setSucessoFilter}
        ultimasAutomacoes={ultimasAutomacoes}
        resolveUser={resolveUser}
      />
    </div>
  )
}
