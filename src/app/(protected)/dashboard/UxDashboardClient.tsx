"use client"

import * as React from "react"
import { Clock, DollarSign, Layers, Search } from "lucide-react"
import { cn } from "@/core/utils"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { UserAvatar } from "@/features/equipe/components/EquipePerformanceCard"
import type { EquipeMembroLancamentos } from "@/features/equipe/actions/equipe"
import type { ProgressaoHistoricoEntry } from "@/features/individual/actions/individual-progressao"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  membros: EquipeMembroLancamentos[]
  /** Histórico completo de progressão por userId, ordenado por data DESC. */
  progressaoMap: Record<string, ProgressaoHistoricoEntry[]>
}

interface JiraEntry {
  issueKey: string
  projectName?: string | null
  typeField?: string | null
  started: string
  timeSpentSeconds: number
}

interface MonthStats {
  totalSeconds: number
  prototipacao: number
  pesquisa: number
  aguardando: number
  investimentoCentavos: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março",
  "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro",
  "Outubro", "Novembro", "Dezembro",
]

const QUARTERS = [
  { label: "1º Trimestre", months: [0, 1, 2] },
  { label: "2º Trimestre", months: [3, 4, 5] },
  { label: "3º Trimestre", months: [6, 7, 8] },
  { label: "4º Trimestre", months: [9, 10, 11] },
]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatHHMM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${String(h)}:${pad(m)}`
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDurationAvg(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${pad(m)}min`
}

function emptyMonthStats(): MonthStats {
  return { totalSeconds: 0, prototipacao: 0, pesquisa: 0, aguardando: 0, investimentoCentavos: 0 }
}

function sumStats(a: MonthStats, b: MonthStats): MonthStats {
  return {
    totalSeconds: a.totalSeconds + b.totalSeconds,
    prototipacao: a.prototipacao + b.prototipacao,
    pesquisa: a.pesquisa + b.pesquisa,
    aguardando: a.aguardando + b.aguardando,
    investimentoCentavos: a.investimentoCentavos + b.investimentoCentavos,
  }
}

/**
 * Retorna o valorHora (centavos) vigente para um dado mês/ano.
 * Usa o registro de progressão mais recente com data ≤ último dia do mês.
 * Se não houver registro anterior, usa o mais antigo disponível (fallback).
 */
function getValorHoraForMonth(
  history: ProgressaoHistoricoEntry[],
  year: number,
  monthIndex: number,
): number | null {
  const lastDay = `${year}-${pad(monthIndex + 1)}-${pad(new Date(year, monthIndex + 1, 0).getDate())}`
  // history já ordenado DESC por data — achar o mais recente com data ≤ último dia do mês
  const active = history.find((r) => r.dataYmd <= lastDay && r.valorHora != null)
  if (active) return active.valorHora
  // Sem registro antes do mês — usar o mais antigo como fallback (progressão mais próxima)
  const fallback = [...history].reverse().find((r) => r.valorHora != null)
  return fallback?.valorHora ?? null
}

/**
 * Agrega entries de um único membro por mês.
 * O valorHora é determinado dinamicamente para cada mês com base no histórico de progressão.
 */
function aggregateByMonth(
  entries: JiraEntry[],
  progressaoHistory: ProgressaoHistoricoEntry[],
  year: number,
): MonthStats[] {
  // Group entries by month
  const byMonth: Map<number, { seconds: number; proto: Set<string>; pesq: Set<string>; ag: Set<string> }> = new Map()
  for (let i = 0; i < 12; i++) {
    byMonth.set(i, { seconds: 0, proto: new Set(), pesq: new Set(), ag: new Set() })
  }

  for (const e of entries) {
    // Parse only the date part to avoid timezone shifting the month
    const datePart = e.started.slice(0, 10)
    const month = new Date(`${datePart}T12:00:00`).getMonth()
    if (month < 0 || month > 11) continue
    const bucket = byMonth.get(month)!
    bucket.seconds += e.timeSpentSeconds
    const tf = (e.typeField ?? "").trim().toLowerCase()
    if (tf === "new" || tf === "redesign") bucket.proto.add(e.issueKey)
    if (tf === "research") bucket.pesq.add(e.issueKey)
    if (tf === "usability") bucket.ag.add(e.issueKey)
  }

  return Array.from({ length: 12 }, (_, i) => {
    const bucket = byMonth.get(i)!
    const hours = bucket.seconds / 3600
    const valorHora = getValorHoraForMonth(progressaoHistory, year, i)
    const investimento = valorHora != null ? Math.round(hours * valorHora) : 0
    return {
      totalSeconds: bucket.seconds,
      prototipacao: bucket.proto.size,
      pesquisa: bucket.pesq.size,
      aguardando: bucket.ag.size,
      investimentoCentavos: investimento,
    }
  })
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconVariant,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconVariant: "brand" | "warning" | "success" | "info"
}) {
  const iconCls = cn(
    "hidden sm:flex size-10 shrink-0 items-center justify-center rounded-lg",
    iconVariant === "brand"   && "bg-brand-primary/10 text-brand-primary",
    iconVariant === "warning" && "bg-badge-warning/10 text-badge-warning-text",
    iconVariant === "success" && "bg-badge-success/10 text-badge-success-text",
    iconVariant === "info"    && "bg-badge-info/10 text-badge-info-text",
  )
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
        </div>
        <div className={iconCls}>
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  )
}

// ─── ProductRankCard ──────────────────────────────────────────────────────────

function ProductRankCard({
  title,
  items,
}: {
  title: string
  items: { label: string; count: number; isOther?: boolean }[]
}) {
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="mb-3 text-sm font-semibold text-text-primary">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Sem dados no período.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
              <span
                className={cn(
                  "min-w-0 truncate font-medium",
                  item.isOther ? "text-badge-success-text" : "text-text-primary",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  item.isOther ? "text-badge-success-text" : "text-text-secondary",
                )}
              >
                {item.count} {item.count === 1 ? "protótipo" : "protótipos"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── YearTable ────────────────────────────────────────────────────────────────

function YearTable({ monthStats }: { monthStats: MonthStats[] }) {
  const totalAnual = monthStats.reduce(sumStats, emptyMonthStats())

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Trimestre
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Horas
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Investimento
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Prototipação
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Pesquisa
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Aguardando
            </th>
          </tr>
        </thead>
        <tbody>
          {QUARTERS.map((q) => {
            const qStats = q.months.reduce(
              (acc, mi) => sumStats(acc, monthStats[mi]!),
              emptyMonthStats(),
            )
            return (
              <React.Fragment key={q.label}>
                {/* Quarter row */}
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{q.label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {formatHHMM(qStats.totalSeconds)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {formatBRL(qStats.investimentoCentavos)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.prototipacao}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.pesquisa}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                    {qStats.aguardando}
                  </td>
                </tr>
                {/* Month rows */}
                {q.months.map((mi) => {
                  const ms = monthStats[mi]!
                  return (
                    <tr
                      key={mi}
                      className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/50"
                    >
                      <td className="px-4 py-2 pl-8 text-text-secondary">{MONTHS_PT[mi]}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {formatHHMM(ms.totalSeconds)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {formatBRL(ms.investimentoCentavos)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.prototipacao}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.pesquisa}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-primary">
                        {ms.aguardando}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* Annual total row */}
          <tr className="border-t-2 border-border-default bg-neutral-grey-50">
            <td className="px-4 py-2.5 font-bold text-text-primary">Total</td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {formatHHMM(totalAnual.totalSeconds)}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {formatBRL(totalAnual.investimentoCentavos)}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.prototipacao}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.pesquisa}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-text-primary">
              {totalAnual.aguardando}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function UxDashboardClient({ membros, progressaoMap }: Props) {
  const currentYear = new Date().getFullYear()
  const [ano, setAno] = React.useState(currentYear)
  const [loading, setLoading] = React.useState(false)
  const [monthStats, setMonthStats] = React.useState<MonthStats[] | null>(null)
  const [totalEntries, setTotalEntries] = React.useState(0)

  const yearOptions = React.useMemo(() => {
    const opts: number[] = []
    for (let y = currentYear; y >= currentYear - 3; y--) opts.push(y)
    return opts
  }, [currentYear])

  // ── Derived totals for metric cards ─────────────────────────────────────
  const totalAnual = React.useMemo(
    () => (monthStats ?? []).reduce(sumStats, emptyMonthStats()),
    [monthStats],
  )

  const avgSecondsPerEntry = totalEntries > 0 ? Math.round(totalAnual.totalSeconds / totalEntries) : 0
  const avgInvestimentoCentavos = totalEntries > 0 ? Math.round(totalAnual.investimentoCentavos / totalEntries) : 0

  // ── Product breakdown for cards ─────────────────────────────────────────
  const [protoByProduct, setProtoByProduct] = React.useState<{ label: string; count: number; isOther?: boolean }[]>([])
  const [agByProduct, setAgByProduct] = React.useState<{ label: string; count: number; isOther?: boolean }[]>([])

  const fetchDataWithProducts = React.useCallback(
    async (year: number) => {
      if (membros.length === 0) {
        setMonthStats(Array.from({ length: 12 }, emptyMonthStats))
        setTotalEntries(0)
        setProtoByProduct([])
        setAgByProduct([])
        return
      }
      setLoading(true)
      try {
        // A API limita a 92 dias por chamada — buscar 4 trimestres separados por membro.
        const QUARTERS_RANGES = [
          { from: `${year}-01-01`, to: `${year}-03-31` },
          { from: `${year}-04-01`, to: `${year}-06-30` },
          { from: `${year}-07-01`, to: `${year}-09-30` },
          { from: `${year}-10-01`, to: `${year}-12-31` },
        ]

        async function fetchMemberEntries(userId: string): Promise<JiraEntry[]> {
          const allEntries: JiraEntry[] = []
          for (const { from, to } of QUARTERS_RANGES) {
            const url = `/api/jira/lancamentos?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`
            try {
              const res = await fetch(url)
              if (!res.ok) continue
              const json = (await res.json()) as { entries?: JiraEntry[] }
              allEntries.push(...(json.entries ?? []))
            } catch {
              // silently skip failed quarters
            }
          }
          return allEntries
        }

        const results = await Promise.all(
          membros.map(async (m) => ({
            userId: m.userId,
            entries: await fetchMemberEntries(m.userId),
          })),
        )

        const allEntries: JiraEntry[] = results.flatMap((r) => r.entries)

        // Monthly stats — valorHora determinado por mês a partir do histórico de progressão
        const combined: MonthStats[] = Array.from({ length: 12 }, emptyMonthStats)
        let entryCount = 0
        for (const { entries, userId } of results) {
          const history = progressaoMap[userId] ?? []
          const memberStats = aggregateByMonth(entries, history, year)
          entryCount += entries.length
          for (let i = 0; i < 12; i++) {
            combined[i] = sumStats(combined[i]!, memberStats[i]!)
          }
        }
        setMonthStats(combined)
        setTotalEntries(entryCount)

        // Product breakdown — protótipos
        const protoMap = new Map<string, Set<string>>() // projectName → unique issueKeys
        const agMap = new Map<string, Set<string>>()
        for (const e of allEntries) {
          const tf = (e.typeField ?? "").trim().toLowerCase()
          const proj = e.projectName?.trim() || e.issueKey.split("-")[0] || "Outros"
          if (tf === "new" || tf === "redesign") {
            if (!protoMap.has(proj)) protoMap.set(proj, new Set())
            protoMap.get(proj)!.add(e.issueKey)
          }
          if (tf === "usability") {
            if (!agMap.has(proj)) agMap.set(proj, new Set())
            agMap.get(proj)!.add(e.issueKey)
          }
        }

        function buildTopItems(map: Map<string, Set<string>>) {
          const sorted = [...map.entries()]
            .map(([label, keys]) => ({ label, count: keys.size }))
            .sort((a, b) => b.count - a.count)
          if (sorted.length <= 5) return sorted
          const top4 = sorted.slice(0, 4)
          const otherCount = sorted.slice(4).reduce((s, x) => s + x.count, 0)
          return [...top4, { label: "Outros", count: otherCount, isOther: true }]
        }

        setProtoByProduct(buildTopItems(protoMap))
        setAgByProduct(buildTopItems(agMap))
      } finally {
        setLoading(false)
      }
    },
    [membros, progressaoMap],
  )

  // Replace fetchData with fetchDataWithProducts
  React.useEffect(() => {
    void fetchDataWithProducts(ano)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Visão geral — UX</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Lançamentos, protótipos e investimento da equipe UX
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Team avatars */}
          <div className="flex items-center -space-x-2">
            {membros.slice(0, 6).map((m) => (
              <UserAvatar
                key={m.userId}
                name={m.name}
                photoPath={m.photoPath}
                size={36}
                className="ring-2 ring-surface-card"
              />
            ))}
            {membros.length > 6 && (
              <div
                className="flex size-9 items-center justify-center rounded-full bg-neutral-grey-100 text-xs font-semibold text-text-secondary ring-2 ring-surface-card"
              >
                +{membros.length - 6}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Tempo Médio por Atividade"
          value={loading ? "—" : formatDurationAvg(avgSecondsPerEntry)}
          icon={Clock}
          iconVariant="brand"
        />
        <MetricCard
          label="Invest. Médio por Atividade"
          value={loading ? "—" : formatBRL(avgInvestimentoCentavos)}
          icon={DollarSign}
          iconVariant="success"
        />
        <MetricCard
          label="Protótipos no período"
          value={loading ? "—" : String(totalAnual.prototipacao)}
          icon={Layers}
          iconVariant="warning"
        />
        <MetricCard
          label="Pesquisas no período"
          value={loading ? "—" : String(totalAnual.pesquisa)}
          icon={Search}
          iconVariant="info"
        />
      </div>

      {/* Product breakdown cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProductRankCard
            title="Qtd. de Protótipos por Produto no período"
            items={protoByProduct}
          />
          <ProductRankCard
            title="Aguardando Aprovação no período"
            items={agByProduct.map((i) => ({ ...i }))}
          />
        </div>
      )}

      {/* Yearly table */}
      {loading || monthStats === null ? (
        <SectionSpinner minHeight="min-h-[300px]" />
      ) : (
        <YearTable monthStats={monthStats} />
      )}
    </div>
  )
}
