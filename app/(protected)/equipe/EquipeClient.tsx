"use client"

import React, { useState, useEffect, useTransition } from "react"
import {
  BarChart3, Users, Clock, Calendar,
  ChevronDown, Trophy, Bot, CheckCircle2, XCircle, Layers,
  MonitorCheck, Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPerformanceData, type UserPerformanceData } from "@/lib/actions/equipe"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"

// ── Types ───────────────────────────────────────────────────────────────────

interface Props {
  sistemas: string[]
  modulos: string[]
}

type TabId = "performance" | "chapters" | "horarios" | "ferias"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "chapters",   label: "Chapters",    icon: Users },
  { id: "horarios",   label: "Horários",    icon: Clock },
  { id: "ferias",     label: "Férias e Ausências", icon: Calendar },
]

const PERIODOS = [
  { value: "mes-atual",  label: "Mês atual" },
  { value: "3-meses",    label: "Últimos 3 meses" },
  { value: "6-meses",    label: "Últimos 6 meses" },
  { value: "ano",        label: "Este ano" },
  { value: "todos",      label: "Todos" },
]

// ── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange(periodo: string): { dataInicio?: string; dataFim?: string } {
  const now = new Date()
  const today = now.toISOString().split("T")[0]!
  switch (periodo) {
    case "mes-atual": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { dataInicio: first.toISOString().split("T")[0], dataFim: today }
    }
    case "3-meses": {
      const d = new Date(now); d.setMonth(d.getMonth() - 3)
      return { dataInicio: d.toISOString().split("T")[0], dataFim: today }
    }
    case "6-meses": {
      const d = new Date(now); d.setMonth(d.getMonth() - 6)
      return { dataInicio: d.toISOString().split("T")[0], dataFim: today }
    }
    case "ano": {
      const first = new Date(now.getFullYear(), 0, 1)
      return { dataInicio: first.toISOString().split("T")[0], dataFim: today }
    }
    default:
      return {}
  }
}

// ── Medal config ─────────────────────────────────────────────────────────────

const MEDAL_CONFIG = [
  {
    border:  "border-amber-400",
    bg:      "bg-amber-50 dark:bg-amber-950/20",
    ring:    "ring-2 ring-amber-400",
    badge:   "bg-amber-400 text-white",
    label:   "1º",
    icon:    "🥇",
  },
  {
    border:  "border-slate-400",
    bg:      "bg-slate-50 dark:bg-slate-800/30",
    ring:    "ring-2 ring-slate-400",
    badge:   "bg-slate-400 text-white",
    label:   "2º",
    icon:    "🥈",
  },
  {
    border:  "border-orange-700",
    bg:      "bg-orange-50 dark:bg-orange-950/20",
    ring:    "ring-2 ring-orange-700",
    badge:   "bg-orange-700 text-white",
    label:   "3º",
    icon:    "🥉",
  },
]

// ── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ name, photoPath, size }: { name: string; photoPath: string | null; size: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  if (photoPath) {
    return (
      <img
        src={photoPath}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-brand-primary text-white font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {initials}
    </div>
  )
}

// ── Performance Card ─────────────────────────────────────────────────────────

function PerformanceCard({ user, rank }: { user: UserPerformanceData; rank: number }) {
  const medal = rank <= 3 ? MEDAL_CONFIG[rank - 1] : null

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl bg-surface-card shadow-card border transition-all duration-200 hover:shadow-md",
        medal ? `${medal.border} ${medal.bg}` : "border-border-default",
      )}
    >
      {/* Rank badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        {medal ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow", medal.badge)}>
            {medal.icon} {medal.label}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-surface-input border border-border-default px-2 py-0.5 text-xs font-medium text-text-secondary">
            {rank}º
          </span>
        )}
      </div>

      {/* Photo + identity */}
      <div className="flex flex-col items-center gap-2 px-4 pt-8 pb-4 border-b border-border-default">
        <div className={cn("rounded-full", medal ? medal.ring : "")}>
          <UserAvatar name={user.name} photoPath={user.photoPath} size={medal ? 80 : 64} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary leading-tight">{user.name}</p>
          {user.classificacao && (
            <p className="text-xs text-text-secondary mt-0.5">{user.classificacao}</p>
          )}
        </div>
      </div>

      {/* Sistemas + Módulos */}
      <div className="px-4 py-3 border-b border-border-default space-y-2">
        {user.sistemas.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide mb-1">Sistemas</p>
            <div className="flex flex-wrap gap-1">
              {user.sistemas.map((s) => (
                <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-primary-50 text-brand-primary px-1.5 py-0.5 text-[10px] font-medium">
                  <MonitorCheck className="size-2.5" />{s}
                </span>
              ))}
            </div>
          </div>
        )}
        {user.modulos.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide mb-1">Módulos</p>
            <div className="flex flex-wrap gap-1">
              {user.modulos.slice(0, 4).map((m) => (
                <span key={m} className="rounded-full bg-surface-input border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {m}
                </span>
              ))}
              {user.modulos.length > 4 && (
                <span className="rounded-full bg-surface-input border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary">
                  +{user.modulos.length - 4}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-border-default border-b border-border-default">
        <StatCell icon={<Layers className="size-3 text-text-secondary" />} value={user.cenariosCriados} label="Cenários" />
        <StatCell icon={<CheckCircle2 className="size-3 text-green-500" />} value={user.sucessos} label="Sucessos" />
        <StatCell icon={<XCircle className="size-3 text-destructive" />} value={user.errosEncontrados} label="Erros" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-border-default border-b border-border-default">
        <StatCell icon={<Trophy className="size-3 text-text-secondary" />} value={user.testesExecutados} label="Executados" />
        <StatCell
          icon={<Bot className="size-3 text-brand-primary" />}
          value={`${user.testesAutomatizados} (${user.percentualAutomatizado}%)`}
          label="Automatizados"
        />
      </div>
    </div>
  )
}

function StatCell({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-sm font-semibold text-text-primary">{value}</span>
      </div>
      <span className="text-[10px] text-text-secondary">{label}</span>
    </div>
  )
}

// ── WIP placeholder ──────────────────────────────────────────────────────────

function WipPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-card border border-border-default shadow-card py-20 gap-3">
      <Wrench className="size-8 text-text-secondary/50" />
      <p className="text-base font-medium text-text-secondary">Em desenvolvimento</p>
      <p className="text-sm text-text-secondary/60">{label} estará disponível em breve</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EquipeClient({ sistemas, modulos }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("performance")
  const [sistemaSel, setSistemaSel] = useState("__todos__")
  const [moduloSel, setModuloSel] = useState("__todos__")
  const [periodSel, setPeriodSel] = useState("mes-atual")
  const [users, setUsers] = useState<UserPerformanceData[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (activeTab !== "performance") return
    const { dataInicio, dataFim } = getDateRange(periodSel)
    startTransition(async () => {
      const data = await getPerformanceData({
        sistema: sistemaSel === "__todos__" ? undefined : sistemaSel,
        modulo: moduloSel === "__todos__" ? undefined : moduloSel,
        dataInicio,
        dataFim,
      })
      setUsers(data)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sistemaSel, moduloSel, periodSel])

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-0.5 rounded-xl bg-surface-card border border-border-default shadow-card p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              activeTab === id
                ? "bg-brand-primary text-white shadow-sm"
                : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-card border border-border-default shadow-card px-4 py-3">
            <span className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
              <ChevronDown className="size-3.5" />
              Filtros:
            </span>

            {/* Sistema */}
            <Select value={sistemaSel} onValueChange={(v) => setSistemaSel(v ?? "__todos__")}>
              <SelectTrigger className="h-8 min-w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="__todos__">Todos os sistemas</SelectItem>
                {sistemas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectPopup>
            </Select>

            {/* Módulo */}
            <Select value={moduloSel} onValueChange={(v) => setModuloSel(v ?? "__todos__")}>
              <SelectTrigger className="h-8 min-w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="__todos__">Todos os módulos</SelectItem>
                {modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectPopup>
            </Select>

            {/* Período */}
            <Select value={periodSel} onValueChange={(v) => setPeriodSel(v ?? "mes-atual")}>
              <SelectTrigger className="h-8 min-w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>

          {/* Cards */}
          {isPending ? (
            <div className="flex items-center justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-surface-card border border-border-default shadow-card py-20 gap-3">
              <Users className="size-10 text-text-secondary/40" />
              <p className="text-base font-medium text-text-secondary">Nenhum dado encontrado</p>
              <p className="text-sm text-text-secondary/60">Ajuste os filtros ou aguarde ações dos usuários no sistema</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-3">
              {users.map((u, idx) => (
                <PerformanceCard key={u.userId} user={u} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "chapters" && <WipPlaceholder label="Chapters" />}
      {activeTab === "horarios" && <WipPlaceholder label="Horários" />}
      {activeTab === "ferias" && <WipPlaceholder label="Férias e Ausências" />}
    </div>
  )
}
