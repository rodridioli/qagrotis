"use client"

import React, { useMemo, useState } from "react"
import { Layers, FileText, ClipboardList, Cpu } from "lucide-react"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import { DashboardCharts } from "./DashboardCharts"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { QaUserRecord } from "@/lib/actions/usuarios"
import type { SuiteDashboardRecord } from "@/lib/actions/suites"
import { getLocalCalendarDayStartEndMs } from "@/lib/local-calendar-range"

// ── Types ─────────────────────────────────────────────────────────────────────

export type RankingFilter = "hoje" | "semana" | "mes-atual" | "mes-anterior" | "ano-atual"
export type TestesFilter  = "hoje" | "semana" | "mes-atual" | "mes-anterior" | "ano-atual"
export type ChartFilter   = "hoje" | "semana" | "mes-atual" | "mes-anterior" | "ano-atual"
export interface DataPoint  { label: string; value: number }
export interface RankingItem { createdBy: string; count: number }

/** Chave sintética para execuções sem `executadoPor` / autor resolvível — alinha totais com os gráficos. */
export const RANKING_SEM_ATRIBUICAO = "__sem_atribuicao__"

function isHistoricoResultadoFinal(resultado: string): boolean {
  return resultado === "Sucesso" || resultado === "Erro" || resultado === "Alerta"
}

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
      const { startMs, endMs } = getLocalCalendarDayStartEndMs(now)
      return { start: startMs, end: endMs }
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
    const today = new Date(getLocalCalendarDayStartEndMs(now).startMs)
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
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  allCenarios,
  allModulos,
  allUsers,
  allSuites,
}: Props) {
  const { sistemaSelecionado } = useSistemaSelecionado()

  // ── Filter states ──────────────────────────────────────────────────────────
  const [rankingFilter,       setRankingFilter]       = useState<RankingFilter>("hoje")
  const [rankingModulo,       setRankingModulo]       = useState("")
  const [testesFilter,        setTestesFilter]        = useState<TestesFilter>("hoje")
  const [testesModulo,        setTestesModulo]        = useState("")
  const [errosFilter,         setErrosFilter]         = useState<ChartFilter>("hoje")
  const [errosModulo,         setErrosModulo]         = useState("")
  const [alertasFilter,       setAlertasFilter]       = useState<ChartFilter>("hoje")
  const [alertasModulo,       setAlertasModulo]       = useState("")
  const [sucessoFilter,       setSucessoFilter]       = useState<ChartFilter>("hoje")
  const [sucessoModulo,       setSucessoModulo]       = useState("")
  /** Stable fallback when `createdAt` is missing (avoids Date.now() during render). */
  const [missingCreatedAtFallback] = useState(() => Date.now())

  // ── User map ───────────────────────────────────────────────────────────────
  const userMap = useMemo(() => {
    const map = new Map<string, { displayName: string; photoPath: string | null }>()
    for (const u of allUsers) {
      const display = u.name || (u.email ? u.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()) : "Usuário")
      const photoPath = u.photoPath ?? null
      // Key by email (exact + lowercase), and name for backward compat / session fallbacks
      if (u.email) {
        const em = u.email.trim()
        const entry = { displayName: display, photoPath }
        map.set(em, entry)
        map.set(em.toLowerCase(), entry)
      }
      if (u.name && u.name !== u.email) map.set(u.name, { displayName: display, photoPath })
    }
    return map
  }, [allUsers])

  function resolveUser(createdBy: string | undefined): { displayName: string; photoPath: string | null } {
    if (!createdBy) return { displayName: "Desconhecido", photoPath: null }
    if (createdBy === RANKING_SEM_ATRIBUICAO) {
      return { displayName: "Sem atribuição", photoPath: null }
    }
    // Try exact match (email or name)
    const found = userMap.get(createdBy)
    if (found) return found
    // Try case-insensitive match
    const lower = createdBy.toLowerCase()
    for (const [key, val] of userMap.entries()) {
      if (key.toLowerCase() === lower) return val
    }
    // Try partial name match (first + last name)
    for (const u of allUsers) {
      if (u.name && u.name.toLowerCase().includes(lower)) {
        const display = u.name
        return { displayName: display, photoPath: u.photoPath ?? null }
      }
    }
    // Fallback: format email as name
    if (createdBy.includes("@")) {
      const name = createdBy.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase())
      const byEmail = allUsers.find(
        (u) => (u.email ?? "").toLowerCase() === createdBy.toLowerCase(),
      )
      return { displayName: byEmail?.name || name, photoPath: byEmail?.photoPath ?? null }
    }
    return { displayName: createdBy, photoPath: null }
  }

  // ── Cenários filtrados ─────────────────────────────────────────────────────
  const {
    totalModulos, totalCenarios, totalManuais, totalAutomatizados,
    pctManuais, pctAuto, automationData, ultimasAutomacoes, activeModuleNames,
  } = useMemo(() => {
    const modsFiltrados = allModulos.filter(
      m => m.active && (!sistemaSelecionado || m.sistemaName === sistemaSelecionado)
    )
    const activeModuleNames = new Set(modsFiltrados.map(m => m.name))
    const totalModulos = modsFiltrados.length

    const cenariosFiltrados = allCenarios.filter(
      c => c.active && 
           activeModuleNames.has(c.module) &&
           (!sistemaSelecionado || c.system === sistemaSelecionado)
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
      .sort((a, b) => (b.createdAt ?? missingCreatedAtFallback) - (a.createdAt ?? missingCreatedAtFallback))
      .slice(0, 20)
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
      pctManuais, pctAuto, automationData, ultimasAutomacoes, activeModuleNames,
    }
  }, [allCenarios, allModulos, sistemaSelecionado, missingCreatedAtFallback])

  // ── Cenários por módulo (pie chart) ────────────────────────────────────────
  const cenariosPorModulo = useMemo(() => {
    const activeModuleNames = new Set(
      allModulos.filter(m => m.active && m.sistemaName === sistemaSelecionado).map(m => m.name)
    )
    const counts: Record<string, number> = {}
    allCenarios
      .filter(c => c.active && activeModuleNames.has(c.module))
      .forEach(c => { counts[c.module] = (counts[c.module] ?? 0) + 1 })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [allCenarios, allModulos, sistemaSelecionado])

  // ── Suites filtradas ───────────────────────────────────────────────────────
  const suitesFiltradas = useMemo(() =>
    allSuites.filter(s => 
      (!sistemaSelecionado || s.sistema === sistemaSelecionado) &&
      activeModuleNames.has(s.modulo)
    ),
    [allSuites, sistemaSelecionado, activeModuleNames]
  )

  // ── Lista de módulos do sistema selecionado (para filtros) ─────────────────
  const moduloNames = useMemo(() => {
    const mods = allModulos.filter(m => m.active && (!sistemaSelecionado || m.sistemaName === sistemaSelecionado))
    return mods.map(m => m.name)
  }, [allModulos, sistemaSelecionado])

  /** Módulos de todos os sistemas — filtro do ranking de execuções (histórico de suítes). */
  const rankingModuloNames = useMemo(() => {
    const names = new Set(allModulos.filter((m) => m.active).map((m) => m.name))
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [allModulos])

  // ── Historico entries (flat) ───────────────────────────────────────────────
  const historicoEntries = useMemo(() => {
    const entries: { timestamp: number; resultado: string; module: string }[] = []
    for (const suite of suitesFiltradas) {
      for (const h of suite.historico ?? []) {
        if (h.timestamp) entries.push({ timestamp: h.timestamp, resultado: h.resultado, module: h.module ?? "" })
      }
    }
    return entries
  }, [suitesFiltradas])

  // ── Ranking: execuções no histórico das suítes (todos os sistemas / módulos) ─
  const rankingData = useMemo((): RankingItem[] => {
    const { start, end } = getDateRange(rankingFilter)
    const cenarioById = new Map(allCenarios.map((c) => [c.id, c]))

    const stableUserKey = (u: QaUserRecord): string => {
      const e = u.email?.trim()
      if (e) return e.toLowerCase()
      return u.name?.trim() || u.id
    }

    /** Resolve a session/email/name string to the same key used for active users (lowercase email preferred). */
    const canonicalKeyForAttribution = (raw: string | undefined): string | null => {
      const t = raw?.trim()
      if (!t) return null
      const lower = t.toLowerCase()
      for (const u of allUsers) {
        if (u.email && u.email.toLowerCase() === lower) return stableUserKey(u)
      }
      for (const u of allUsers) {
        if (u.name && u.name.trim() === t) return stableUserKey(u)
      }
      if (t.includes("@")) return lower
      return null
    }

    const countByUser = new Map<string, number>()
    // Mesmo conjunto de suítes que alimenta os gráficos (sistema + módulo ativo)
    for (const suite of suitesFiltradas) {
      for (const h of suite.historico ?? []) {
        const ts = h.timestamp ?? 0
        if (!ts || ts < start || ts > end) continue
        if (rankingModulo && (h.module ?? "") !== rankingModulo) continue
        if (!isHistoricoResultadoFinal(h.resultado)) continue
        const fromRunner = canonicalKeyForAttribution(h.executadoPor)
        const fromAuthor = canonicalKeyForAttribution(cenarioById.get(h.id)?.createdBy)
        const key = fromRunner ?? fromAuthor ?? RANKING_SEM_ATRIBUICAO
        countByUser.set(key, (countByUser.get(key) ?? 0) + 1)
      }
    }

    const activeUsers = allUsers.filter((u) => u.active)
    const rows = activeUsers.map((u) => {
      const k = stableUserKey(u)
      return { createdBy: k, count: countByUser.get(k) ?? 0 }
    })
    const orphan = countByUser.get(RANKING_SEM_ATRIBUICAO) ?? 0
    if (orphan > 0) {
      rows.push({ createdBy: RANKING_SEM_ATRIBUICAO, count: orphan })
    }
    return rows
      .sort((a, b) => b.count - a.count || a.createdBy.localeCompare(b.createdBy))
      .slice(0, 4)
  }, [suitesFiltradas, allCenarios, rankingFilter, rankingModulo, allUsers])

  // ── Testes chart ───────────────────────────────────────────────────────────
  const testesData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(testesFilter)
    const entries = testesModulo
      ? historicoEntries.filter(e => e.module === testesModulo)
      : historicoEntries
    return buckets.map(b => ({
      label: b.label,
      value: entries.filter(e => e.timestamp >= b.start && e.timestamp <= b.end).length,
    }))
  }, [historicoEntries, testesFilter, testesModulo])

  /** Execuções com resultado Pendente (entram no gráfico de volume, não na soma Erro+Alerta+Sucesso). */
  const testesPendenteCount = useMemo(() => {
    const buckets = makeBuckets(testesFilter)
    const entries = testesModulo
      ? historicoEntries.filter(e => e.module === testesModulo)
      : historicoEntries
    let n = 0
    for (const b of buckets) {
      n += entries.filter(
        e => e.timestamp >= b.start && e.timestamp <= b.end && e.resultado === "Pendente",
      ).length
    }
    return n
  }, [historicoEntries, testesFilter, testesModulo])

  // ── Erros chart ────────────────────────────────────────────────────────────
  const errosData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(errosFilter)
    const entries = errosModulo
      ? historicoEntries.filter(e => e.module === errosModulo)
      : historicoEntries
    return buckets.map(b => ({
      label: b.label,
      value: entries.filter(
        e => e.timestamp >= b.start && e.timestamp <= b.end && e.resultado === "Erro"
      ).length,
    }))
  }, [historicoEntries, errosFilter, errosModulo])

  // ── Alertas chart ───────────────────────────────────────────────────────────
  const alertasData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(alertasFilter)
    const entries = alertasModulo
      ? historicoEntries.filter(e => e.module === alertasModulo)
      : historicoEntries
    return buckets.map(b => ({
      label: b.label,
      value: entries.filter(
        e => e.timestamp >= b.start && e.timestamp <= b.end && e.resultado === "Alerta",
      ).length,
    }))
  }, [historicoEntries, alertasFilter, alertasModulo])

  // ── Sucesso chart ──────────────────────────────────────────────────────────
  const sucessoData = useMemo((): DataPoint[] => {
    const buckets = makeBuckets(sucessoFilter)
    const entries = sucessoModulo
      ? historicoEntries.filter(e => e.module === sucessoModulo)
      : historicoEntries
    return buckets.map(b => ({
      label: b.label,
      value: entries.filter(
        e => e.timestamp >= b.start && e.timestamp <= b.end && e.resultado === "Sucesso"
      ).length,
    }))
  }, [historicoEntries, sucessoFilter, sucessoModulo])

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
        moduloNames={moduloNames}
        rankingModuloNames={rankingModuloNames}
        rankingData={rankingData}
        rankingFilter={rankingFilter}
        onRankingFilterChange={setRankingFilter}
        rankingModulo={rankingModulo}
        onRankingModuloChange={setRankingModulo}
        testesData={testesData}
        testesFilter={testesFilter}
        onTestesFilterChange={setTestesFilter}
        testesModulo={testesModulo}
        onTestesModuloChange={setTestesModulo}
        testesPendenteCount={testesPendenteCount}
        errosData={errosData}
        errosFilter={errosFilter}
        onErrosFilterChange={setErrosFilter}
        errosModulo={errosModulo}
        onErrosModuloChange={setErrosModulo}
        alertasData={alertasData}
        alertasFilter={alertasFilter}
        onAlertasFilterChange={setAlertasFilter}
        alertasModulo={alertasModulo}
        onAlertasModuloChange={setAlertasModulo}
        sucessoData={sucessoData}
        sucessoFilter={sucessoFilter}
        onSucessoFilterChange={setSucessoFilter}
        sucessoModulo={sucessoModulo}
        onSucessoModuloChange={setSucessoModulo}
        ultimasAutomacoes={ultimasAutomacoes}
        resolveUser={resolveUser}
        cenariosPorModulo={cenariosPorModulo}
      />
    </div>
  )
}
