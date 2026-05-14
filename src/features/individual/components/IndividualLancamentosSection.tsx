"use client"

import * as React from "react"
import {
  AlertTriangle,
  BarChart3,
  Bug,
  Flame,
  Hash,
  Layers,
} from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { Button } from "@/components/ui/button"
import { cn } from "@/core/utils"
import {
  getLancamentosPresetRange,
  type LancamentosPeriodPreset,
} from "@/features/individual/lib/individual-lancamentos-date-presets"

export interface IndividualLancamentosSectionProps {
  evaluatedUserId: string
}

type LancamentoRow = {
  id: string
  issueKey: string
  projectKey: string
  summary: string | null
  issueType?: string | null
  priority?: string | null
  labels?: string[]
  qtdCenariosQA?: number | null
  started: string
  timeSpentSeconds: number
  hours: number
  isLongSession: boolean
  comment: string | null
  dataSource?: "jira" | "clockwork"
}

type ApiOk = {
  source: "jira"
  entries: LancamentoRow[]
  totalSeconds: number
  longSessionCount: number
  truncatedIssues: boolean
  truncatedWorklogs: boolean
  noJiraUser: boolean
  jiraBrowseBase?: string
  message?: string
  jiraAuthorDisplayName?: string | null
  includesClockwork?: boolean
  clockworkMergedCount?: number
  brokenTestsOpenedCount?: number
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatHoursShort(hours: number): string {
  if (hours === Math.floor(hours)) return `${hours} h`
  return `${hours.toFixed(2)} h`
}

function alertLevel(hours: number): "red" | "yellow" | null {
  if (hours > 10) return "red"
  if (hours > 6) return "yellow"
  return null
}

// ── Dashboard stats ─────────────────────────────────────────────────────────

type ProjectHours = { key: string; seconds: number }

function normalizePriorityToken(p: string): string {
  return p
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function priorityIsCritical(p: string | null | undefined): boolean {
  if (!p?.trim()) return false
  const n = normalizePriorityToken(p)
  return (
    n === "critical" ||
    n === "highest" ||
    n === "critica" ||
    n === "alta" ||
    n.includes("critical") ||
    n.includes("critica")
  )
}

function computeStats(entries: LancamentoRow[]) {
  const projectMap = new Map<string, number>()
  const issueSet = new Set<string>()
  const criticalIssues = new Set<string>()
  const brokenTestIssues = new Set<string>()
  const qtdByIssue = new Map<string, number>()

  const isBrokenTest = (e: LancamentoRow) =>
    (e.issueType ?? "").toLowerCase().includes("broken")

  for (const e of entries) {
    const pk = e.projectKey || e.issueKey.split("-")[0]
    projectMap.set(pk, (projectMap.get(pk) ?? 0) + e.timeSpentSeconds)
    issueSet.add(e.issueKey)
    if (priorityIsCritical(e.priority)) criticalIssues.add(e.issueKey)
    if (isBrokenTest(e)) brokenTestIssues.add(e.issueKey)
    if (e.qtdCenariosQA != null && Number.isFinite(e.qtdCenariosQA)) {
      const prev = qtdByIssue.get(e.issueKey) ?? 0
      qtdByIssue.set(e.issueKey, Math.max(prev, e.qtdCenariosQA))
    }
  }

  let qtdCenariosTotal = 0
  for (const v of qtdByIssue.values()) {
    qtdCenariosTotal += v
  }

  const projectHours: ProjectHours[] = Array.from(projectMap.entries())
    .map(([key, seconds]) => ({ key, seconds }))
    .sort((a, b) => b.seconds - a.seconds)

  return {
    projectHours,
    totalIssues: issueSet.size,
    criticalCount: criticalIssues.size,
    brokenTestCountFromWorklogs: brokenTestIssues.size,
    qtdCenariosTotal,
  }
}

// ── Dashboard panel ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  accent?: "red" | "amber" | "violet" | "blue" | "green" | "teal"
}) {
  const accentMap: Record<string, string> = {
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  }
  const iconClass = accent ? accentMap[accent] : "bg-neutral-grey-100 text-text-secondary"
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", iconClass)}>
          {icon}
        </span>
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-text-primary">{value}</div>
    </div>
  )
}

function ProjectBar({ projectHours }: { projectHours: ProjectHours[] }) {
  if (projectHours.length === 0) return null
  const max = projectHours[0].seconds
  const totalSeconds = projectHours.reduce((acc, p) => acc + p.seconds, 0)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-card p-4 shadow-card md:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <BarChart3 className="size-4" />
          </span>
          <span className="text-xs font-medium text-text-secondary">Horas por Projeto</span>
        </div>
        <span className="text-xs font-medium tabular-nums text-text-secondary">
          Total:{" "}
          <span className="font-semibold text-text-primary">{formatHours(totalSeconds)}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {projectHours.map((p) => (
          <div key={p.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-right font-mono text-xs font-medium text-text-primary">
              {p.key}
            </span>
            <div className="flex-1 overflow-hidden rounded-full bg-neutral-grey-100">
              <div
                className="h-2 rounded-full bg-brand-primary transition-all"
                style={{ width: `${Math.round((p.seconds / max) * 100)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-xs tabular-nums text-text-secondary">
              {formatHours(p.seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardPanel({
  entries,
  brokenTestsOpenedCount,
}: {
  entries: LancamentoRow[]
  brokenTestsOpenedCount?: number
}) {
  const stats = React.useMemo(() => computeStats(entries), [entries])
  const retornoDeTestes =
    brokenTestsOpenedCount != null ? brokenTestsOpenedCount : stats.brokenTestCountFromWorklogs

  return (
    <div className="flex flex-col gap-3">
      <ProjectBar projectHours={stats.projectHours} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <StatCard
          icon={<Hash className="size-4" />}
          label="Total de Jiras"
          value={stats.totalIssues}
          accent="blue"
        />
        <StatCard
          icon={<Flame className="size-4" />}
          label="Jiras críticos"
          value={stats.criticalCount}
          accent="red"
        />
        <StatCard
          icon={<Bug className="size-4" />}
          label="Retorno de Testes"
          value={retornoDeTestes}
          accent="amber"
        />
        <StatCard
          icon={<Layers className="size-4" />}
          label="Testes Realizados"
          value={stats.qtdCenariosTotal}
          accent="teal"
        />
      </div>
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

export function IndividualLancamentosSection({ evaluatedUserId }: IndividualLancamentosSectionProps) {
  const [preset, setPreset] = React.useState<LancamentosPeriodPreset>("week")
  const [from, setFrom] = React.useState(() => getLancamentosPresetRange("week").from)
  const [to, setTo] = React.useState(() => getLancamentosPresetRange("week").to)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ApiOk | null>(null)
  const [jiraBase, setJiraBase] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/jira/credentials", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { jiraUrl?: string } | null) => {
        if (cancelled || !d?.jiraUrl?.trim()) return
        setJiraBase((prev) => prev ?? String(d.jiraUrl).replace(/\/$/, ""))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      from,
      to,
      userId: evaluatedUserId,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    try {
      const res = await fetch(`/api/jira/lancamentos?${qs}`, { credentials: "same-origin" })
      const body = (await res.json().catch(() => null)) as ApiOk | { error?: string } | null
      if (!res.ok) {
        const msg =
          typeof body === "object" && body && "error" in body && typeof body.error === "string"
            ? body.error
            : "Não foi possível carregar os lançamentos."
        throw new Error(msg)
      }
      const ok = body as ApiOk
      setData(ok)
      if (ok.jiraBrowseBase?.trim()) {
        setJiraBase(ok.jiraBrowseBase.replace(/\/$/, ""))
      }
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [evaluatedUserId, from, to])

  React.useEffect(() => {
    void load()
  }, [load])

  function applyPreset(p: LancamentosPeriodPreset) {
    const r = getLancamentosPresetRange(p)
    setPreset(p)
    setFrom(r.from)
    setTo(r.to)
  }

  const allEntries = data?.entries ?? []

  const filtered = React.useMemo(() => {
    if (!search.trim()) return allEntries
    const q = search.trim().toLowerCase()
    return allEntries.filter(
      (e) =>
        e.issueKey.toLowerCase().includes(q) ||
        (e.summary ?? "").toLowerCase().includes(q) ||
        (e.priority ?? "").toLowerCase().includes(q),
    )
  }, [allEntries, search])

  const filteredTotalSeconds = React.useMemo(
    () => filtered.reduce((acc, e) => acc + e.timeSpentSeconds, 0),
    [filtered],
  )

  const toolbarLeadingSummary = (
    <span className="text-sm font-medium text-text-primary">
      Lançamentos:{" "}
      <span className="font-bold">{filtered.length.toLocaleString("pt-BR")}</span>
      {" - "}
      Total de Horas:{" "}
      <span className="font-bold">{formatHours(filteredTotalSeconds)}</span>
    </span>
  )

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Preset filters */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["today", "Hoje"],
            ["yesterday", "Ontem"],
            ["week", "Semana"],
            ["month", "Mês Atual"],
            ["lastMonth", "Mês Anterior"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={preset === key ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <SectionSpinner label="A carregar lançamentos…" />
      ) : error ? (
        <EmptyState message={`Erro: ${error}`} />
      ) : data ? (
        <>
          {data.noJiraUser && data.entries.length > 0 ? (
            <div
              className="rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm text-text-secondary"
              role="status"
            >
              <p className="font-medium text-text-primary">Utilizador Jira não encontrado por e-mail</p>
              <p className="mt-1">
                A tabela pode mostrar apenas lançamentos vindos da API Clockwork. Associe o mesmo e-mail no Jira
                para alinhar worklogs nativos.
              </p>
            </div>
          ) : null}

          {data.truncatedIssues || data.truncatedWorklogs ? (
            <p className="text-sm text-text-secondary">
              {data.truncatedIssues
                ? "Lista de issues truncada (limite do servidor). Reduza o intervalo para ver mais."
                : null}
              {data.truncatedIssues && data.truncatedWorklogs ? " " : ""}
              {data.truncatedWorklogs
                ? "Lista de lançamentos truncada (limite do servidor). Reduza o intervalo."
                : null}
            </p>
          ) : null}

          {/* Dashboard totals */}
          {allEntries.length > 0 && (
            <DashboardPanel
              entries={allEntries}
              brokenTestsOpenedCount={data.brokenTestsOpenedCount}
            />
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
            <TableToolbar
              search={search}
              onSearchChange={(v) => setSearch(v)}
              searchPlaceholder="Buscar por Jira, título ou prioridade…"
              leadingSummary={toolbarLeadingSummary}
              baseCount={allEntries.length}
            />

            {filtered.length === 0 ? (
              <EmptyState message="Nenhum registro encontrado." className="mx-5 my-8" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900/40">
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Jira</th>
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Projeto</th>
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Prioridade</th>
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Título</th>
                      <th className="hidden px-3 py-2 text-xs font-semibold text-text-secondary sm:table-cell">Fonte</th>
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Data</th>
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Tempo</th>
                      <th className="px-3 py-2 text-xs font-semibold text-text-secondary">Comentário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const alert = alertLevel(row.hours)
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b border-border-default last:border-0",
                            alert === "red"
                              ? "bg-red-500/10"
                              : alert === "yellow"
                                ? "bg-amber-500/10"
                                : "hover:bg-neutral-grey-50/80 dark:hover:bg-neutral-grey-900/30",
                          )}
                        >
                          {/* Jira */}
                          <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">
                            {jiraBase ? (
                              <a
                                href={`${jiraBase}/browse/${encodeURIComponent(row.issueKey)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-brand-primary underline-offset-2 hover:underline"
                              >
                                {row.issueKey}
                              </a>
                            ) : (
                              <span className="font-semibold">{row.issueKey}</span>
                            )}
                          </td>
                          {/* Projeto */}
                          <td className="whitespace-nowrap px-3 py-2 align-top text-xs font-medium text-text-secondary">
                            {row.projectKey || row.issueKey.split("-")[0]}
                          </td>
                          {/* Prioridade */}
                          <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-text-primary">
                            {row.priority?.trim() ? row.priority : "—"}
                          </td>
                          {/* Título */}
                          <td className="max-w-[16rem] px-3 py-2 align-top text-text-primary">
                            {row.summary ?? "—"}
                          </td>
                          {/* Fonte */}
                          <td className="hidden whitespace-nowrap px-3 py-2 align-top text-xs text-text-secondary sm:table-cell">
                            {row.dataSource === "clockwork" ? (
                              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-medium text-violet-800 dark:text-violet-200">
                                Clockwork
                              </span>
                            ) : (
                              <span className="text-text-secondary">Jira</span>
                            )}
                          </td>
                          {/* Data */}
                          <td className="whitespace-nowrap px-3 py-2 align-top text-text-secondary">
                            {new Date(row.started).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          {/* Tempo */}
                          <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums font-medium">
                            <div className="flex items-center gap-1.5">
                              {alert === "red" ? (
                                <AlertTriangle
                                  className="size-4 shrink-0 text-destructive"
                                  aria-label="Mais de 10 horas lançadas"
                                />
                              ) : alert === "yellow" ? (
                                <AlertTriangle
                                  className="size-4 shrink-0 text-amber-500"
                                  aria-label="Mais de 6 horas lançadas"
                                />
                              ) : null}
                              {formatHoursShort(row.hours)}
                            </div>
                          </td>
                          {/* Comentário */}
                          <td className="max-w-[18rem] px-3 py-2 align-top text-text-secondary">
                            {row.comment ? (
                              <span className="line-clamp-3" title={row.comment}>
                                {row.comment}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
