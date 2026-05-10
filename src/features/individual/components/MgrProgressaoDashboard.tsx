"use client"

import * as React from "react"
import {
  BarChart2,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  Network,
  Users,
} from "lucide-react"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import {
  getMgrDashboardStats,
  getMgrRecentAvaliacoes,
  getMgrUsuariosPorPerfil,
  getMgrSmallCardStats,
} from "@/features/individual/actions/individual-mgr-dashboard"

// ── Types ─────────────────────────────────────────────────────────────────────

type Stats = { perfisDeAcesso: number; usuarios: number; feedbacks: number; avaliacoes: number }
type Avaliacao = {
  id: string
  evaluatedUserName: string
  evaluatedUserProfile: string
  evaluatorName: string
  score: number | null
  createdAt: string
}
type ProfileCount = { perfil: string; count: number }
type SmallStats = { avaliacoes: number; feedbacks: number; chapters: number; ausencias: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDatePt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function scoreLabel(score: number | null): string {
  if (score === null) return "—"
  return `${score.toFixed(1)}%`
}

// ── Top stat card ─────────────────────────────────────────────────────────────

function TopCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Users
  color: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-text-secondary">{label}</p>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-text-primary">{value.toLocaleString("pt-BR")}</p>
    </div>
  )
}

// ── Small stat card ───────────────────────────────────────────────────────────

function SmallCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-card px-4 py-3 shadow-card">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-grey-100 text-text-secondary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="text-lg font-bold tabular-nums text-text-primary">{value.toLocaleString("pt-BR")}</p>
      </div>
    </div>
  )
}

// ── Profile bar ───────────────────────────────────────────────────────────────

function ProfileBar({ perfil, count, total }: { perfil: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-text-primary">{perfil}</span>
        <span className="tabular-nums text-text-secondary">
          {count} <span className="text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-grey-100">
        <div
          className="h-2 rounded-full bg-brand-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MgrProgressaoDashboard() {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [avaliacoes, setAvaliacoes] = React.useState<Avaliacao[]>([])
  const [profiles, setProfiles] = React.useState<ProfileCount[]>([])
  const [smallStats, setSmallStats] = React.useState<SmallStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filterPerfil, setFilterPerfil] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [s, a, p, ss] = await Promise.all([
        getMgrDashboardStats(),
        getMgrRecentAvaliacoes(filterPerfil ? { perfil: filterPerfil } : undefined),
        getMgrUsuariosPorPerfil(),
        getMgrSmallCardStats(),
      ])
      if (!("error" in s)) setStats(s)
      if (!Array.isArray(a) ? false : true) setAvaliacoes(a as Avaliacao[])
      if (!Array.isArray(p) ? false : true) setProfiles(p as ProfileCount[])
      if (!("error" in ss)) setSmallStats(ss)
    } finally {
      setLoading(false)
    }
  }, [filterPerfil])

  React.useEffect(() => { void load() }, [load])

  const totalUsers = profiles.reduce((sum, p) => sum + p.count, 0)

  const profileOptions = React.useMemo(
    () => Array.from(new Set(profiles.map((p) => p.perfil))).sort(),
    [profiles],
  )

  if (loading) return <SectionSpinner />

  return (
    <div className="space-y-6">
      {/* Top cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TopCard
            label="Perfis de Acesso"
            value={stats.perfisDeAcesso}
            icon={Network}
            color="bg-purple-100 text-purple-600"
          />
          <TopCard
            label="Usuários Ativos"
            value={stats.usuarios}
            icon={Users}
            color="bg-brand-primary/10 text-brand-primary"
          />
          <TopCard
            label="Feedbacks"
            value={stats.feedbacks}
            icon={MessageSquare}
            color="bg-emerald-100 text-emerald-600"
          />
          <TopCard
            label="Avaliações"
            value={stats.avaliacoes}
            icon={ClipboardCheck}
            color="bg-amber-100 text-amber-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent evaluations table */}
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border-default px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4.5 text-brand-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-text-primary">Últimas Avaliações</h2>
            </div>
            <select
              value={filterPerfil}
              onChange={(e) => setFilterPerfil(e.target.value)}
              aria-label="Filtrar por perfil"
              className="h-8 rounded-custom border border-border-default bg-surface-input px-2 text-xs text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">Todos os perfis</option>
              {profileOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {avaliacoes.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
              Nenhuma avaliação encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Colaborador</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Perfil</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Avaliador</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Pontuação</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {avaliacoes.map((a) => (
                    <tr key={a.id} className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/50">
                      <td className="px-4 py-3 font-medium text-text-primary">{a.evaluatedUserName}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-border-default bg-neutral-grey-50 px-2 py-0.5 text-xs font-medium text-text-secondary">
                          {a.evaluatedUserProfile || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{a.evaluatorName}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-primary">
                        {scoreLabel(a.score)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-text-secondary">
                        {formatDatePt(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Profile distribution */}
        <div className="rounded-xl border border-border-default bg-surface-card shadow-card">
          <div className="flex items-center gap-2 border-b border-border-default px-5 py-4">
            <BarChart2 className="size-4.5 text-brand-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-text-primary">Usuários por Perfil</h2>
          </div>
          <div className="space-y-4 p-5">
            {profiles.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhum dado disponível.</p>
            ) : (
              profiles.map((p) => (
                <ProfileBar key={p.perfil} perfil={p.perfil} count={p.count} total={totalUsers} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Small cards */}
      {smallStats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SmallCard label="Avaliações concluídas" value={smallStats.avaliacoes} icon={ClipboardCheck} />
          <SmallCard label="Feedbacks concluídos" value={smallStats.feedbacks} icon={MessageSquare} />
          <SmallCard label="Chapters realizados" value={smallStats.chapters} icon={BookOpen} />
          <SmallCard label="Ausências registradas" value={smallStats.ausencias} icon={Users} />
        </div>
      )}
    </div>
  )
}
