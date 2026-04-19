"use client"

import React, { useState, useEffect, useTransition, useMemo } from "react"
import { BarChart3, Users, Clock, Calendar, Bot, CheckCircle2, XCircle, Layers, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPerformanceData, type UserPerformanceData } from "@/lib/actions/equipe"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  sistemas: string[]
  modulosPorSistema: Record<string, string[]>
}

type TabId = "performance" | "chapters" | "horarios" | "ferias"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "performance", label: "Performance",        icon: BarChart3 },
  { id: "chapters",   label: "Chapters",            icon: Users     },
  { id: "horarios",   label: "Horários",            icon: Clock     },
  { id: "ferias",     label: "Férias e Ausências",  icon: Calendar  },
]

const PERIODOS = [
  { value: "hoje",        label: "Hoje"          },
  { value: "mes-atual",   label: "Mês Atual"     },
  { value: "mes-anterior",label: "Mês Anterior"  },
  { value: "ano",         label: "Ano"           },
]

// ── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange(periodo: string): { dataInicio?: string; dataFim?: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)

  switch (periodo) {
    case "hoje":
      return { dataInicio: today, dataFim: today }
    case "mes-atual": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { dataInicio: fmt(first), dataFim: today }
    }
    case "mes-anterior": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last  = new Date(now.getFullYear(), now.getMonth(), 0)
      return { dataInicio: fmt(first), dataFim: fmt(last) }
    }
    case "ano": {
      const first = new Date(now.getFullYear(), 0, 1)
      return { dataInicio: fmt(first), dataFim: today }
    }
    default:
      return {}
  }
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({
  name,
  photoPath,
  size,
  ringClass,
}: {
  name: string
  photoPath: string | null
  size: number
  ringClass?: string
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const base = `rounded-full flex-shrink-0 ${ringClass ?? ""}`

  if (photoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoPath}
        alt={name}
        className={cn(base, "object-cover")}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={cn(base, "flex items-center justify-center bg-brand-primary text-white font-semibold")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {initials}
    </div>
  )
}

// ── Medal config ─────────────────────────────────────────────────────────────

const MEDALS = [
  {
    cardBorder:  "border-2 border-amber-400",
    cardShadow:  "shadow-[0_4px_24px_0_rgb(251_191_36_/_0.25)]",
    headerBg:    "bg-amber-50 dark:bg-amber-950/20",
    badgeBg:     "bg-amber-400",
    ringClass:   "ring-4 ring-amber-400 ring-offset-2",
    emoji:       "🥇",
    label:       "1º lugar",
    avatarSize:  80,
  },
  {
    cardBorder:  "border-2 border-slate-300",
    cardShadow:  "shadow-[0_4px_16px_0_rgb(148_163_184_/_0.20)]",
    headerBg:    "bg-slate-50 dark:bg-slate-800/30",
    badgeBg:     "bg-slate-400",
    ringClass:   "ring-4 ring-slate-300 ring-offset-2",
    emoji:       "🥈",
    label:       "2º lugar",
    avatarSize:  72,
  },
  {
    cardBorder:  "border-2 border-orange-400",
    cardShadow:  "shadow-[0_4px_16px_0_rgb(251_146_60_/_0.20)]",
    headerBg:    "bg-orange-50 dark:bg-orange-950/20",
    badgeBg:     "bg-orange-500",
    ringClass:   "ring-4 ring-orange-400 ring-offset-2",
    emoji:       "🥉",
    label:       "3º lugar",
    avatarSize:  68,
  },
]

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-input overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-primary transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

// ── Performance Card ─────────────────────────────────────────────────────────

function PerformanceCard({ user, rank }: { user: UserPerformanceData; rank: number }) {
  const medal = rank <= 3 ? MEDALS[rank - 1]! : null
  const avatarSize = medal?.avatarSize ?? 56

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl bg-surface-card border overflow-hidden",
        medal
          ? `${medal.cardBorder} ${medal.cardShadow}`
          : "border-border-default shadow-card",
      )}
    >
      {/* Rank badge — acima do card, bem visível */}
      {medal && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white shadow-md",
              medal.badgeBg,
            )}
          >
            {medal.emoji} {medal.label}
          </span>
        </div>
      )}

      {/* Header com avatar + identidade */}
      <div
        className={cn(
          "flex flex-col items-center gap-3 px-4 pb-4 border-b border-border-default",
          medal ? `${medal.headerBg} pt-8` : "pt-5",
        )}
      >
        {!medal && (
          <span className="self-end -mt-1 mb-1 inline-flex items-center rounded-full border border-border-default bg-surface-input px-2 py-0.5 text-xs font-medium text-text-secondary">
            {rank}º
          </span>
        )}
        <UserAvatar
          name={user.name}
          photoPath={user.photoPath}
          size={avatarSize}
          ringClass={medal?.ringClass}
        />
        <div className="text-center space-y-0.5">
          <p className="text-base font-semibold text-text-primary leading-tight">{user.name}</p>
          {user.classificacao ? (
            <p className="text-sm text-text-secondary">{user.classificacao}</p>
          ) : (
            <p className="text-sm text-text-secondary/40 italic">Sem classificação</p>
          )}
        </div>
      </div>

      {/* Sistemas + Módulos */}
      <div className="px-4 py-3 border-b border-border-default space-y-2.5">
        {user.sistemas.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Sistemas</p>
            <div className="flex flex-wrap gap-1">
              {user.sistemas.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full bg-primary-50 text-brand-primary px-2 py-0.5 text-xs font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {user.modulos.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Módulos</p>
            <div className="flex flex-wrap gap-1">
              {user.modulos.slice(0, 5).map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-border-default bg-surface-input px-2 py-0.5 text-xs text-text-secondary"
                >
                  {m}
                </span>
              ))}
              {user.modulos.length > 5 && (
                <span className="rounded-full border border-border-default bg-surface-input px-2 py-0.5 text-xs text-text-secondary">
                  +{user.modulos.length - 5}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Métricas — grid 2×2 com números grandes */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border-default border-b border-border-default">
        <MetricCell
          icon={<Layers className="size-3.5 text-text-secondary" />}
          label="Cenários"
          value={user.cenariosCriados}
        />
        <MetricCell
          icon={<Trophy className="size-3.5 text-text-secondary" />}
          label="Executados"
          value={user.testesExecutados}
        />
        <MetricCell
          icon={<CheckCircle2 className="size-3.5 text-green-500" />}
          label="Sucessos"
          value={user.sucessos}
          valueClass="text-green-600 dark:text-green-400"
        />
        <MetricCell
          icon={<XCircle className="size-3.5 text-destructive" />}
          label="Erros"
          value={user.errosEncontrados}
          valueClass="text-destructive"
        />
      </div>

      {/* Automação */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="size-3.5 text-brand-primary" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Automatizados
            </span>
          </div>
          <span className="text-sm font-semibold text-text-primary">
            {user.testesAutomatizados}{" "}
            <span className="text-xs font-medium text-text-secondary">
              ({user.percentualAutomatizado}%)
            </span>
          </span>
        </div>
        <ProgressBar value={user.percentualAutomatizado} />
      </div>
    </div>
  )
}

function MetricCell({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode
  label: string
  value: number
  valueClass?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-3">
      <div className="flex items-center gap-1 text-text-secondary mb-0.5">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <span className={cn("text-2xl font-bold text-text-primary", valueClass)}>
        {value}
      </span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EquipeClient({ sistemas, modulosPorSistema }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("performance")

  // Filter state
  const [sistemaSel, setSistemaSel] = useState("__todos__")
  const [moduloSel,  setModuloSel]  = useState("__todos__")
  const [periodoSel, setPeriodoSel] = useState("mes-atual")

  // Applied filter (only updates on click Filtrar)
  const [applied, setApplied] = useState({ sistema: "__todos__", modulo: "__todos__", periodo: "mes-atual" })

  const [users, setUsers] = useState<UserPerformanceData[]>([])
  const [isPending, startTransition] = useTransition()

  // Derived modulos list based on selected sistema
  const modulosDisponiveis = useMemo<string[]>(() => {
    if (sistemaSel === "__todos__") {
      return [...new Set(Object.values(modulosPorSistema).flat())]
    }
    return modulosPorSistema[sistemaSel] ?? []
  }, [sistemaSel, modulosPorSistema])

  // Reset módulo when sistema changes
  useEffect(() => {
    setModuloSel("__todos__")
  }, [sistemaSel])

  // Fetch on applied change
  useEffect(() => {
    if (activeTab !== "performance") return
    const { dataInicio, dataFim } = getDateRange(applied.periodo)
    startTransition(async () => {
      const data = await getPerformanceData({
        sistema:    applied.sistema === "__todos__" ? undefined : applied.sistema,
        modulo:     applied.modulo  === "__todos__" ? undefined : applied.modulo,
        dataInicio,
        dataFim,
      })
      setUsers(data)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, activeTab])

  function handleFiltrar() {
    setApplied({ sistema: sistemaSel, modulo: moduloSel, periodo: periodoSel })
  }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-0.5 rounded-xl bg-surface-card border border-border-default shadow-card p-1 w-fit">
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

      {/* ── Performance tab ── */}
      {activeTab === "performance" && (
        <div className="space-y-5">
          {/* Filtros — linha única */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface-card border border-border-default shadow-card px-5 py-4">
            {/* Sistema */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Sistema</label>
              <Select value={sistemaSel} onValueChange={(v) => setSistemaSel(v ?? "__todos__")}>
                <SelectTrigger className="h-9 min-w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="__todos__">Todos os sistemas</SelectItem>
                  {sistemas.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {/* Módulo — dependente do sistema */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Módulo</label>
              <Select value={moduloSel} onValueChange={(v) => setModuloSel(v ?? "__todos__")}>
                <SelectTrigger className="h-9 min-w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="__todos__">Todos os módulos</SelectItem>
                  {modulosDisponiveis.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {/* Período */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Período</label>
              <Select value={periodoSel} onValueChange={(v) => setPeriodoSel(v ?? "mes-atual")}>
                <SelectTrigger className="h-9 min-w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {/* Botão */}
            <Button onClick={handleFiltrar} disabled={isPending} className="h-9 self-end">
              {isPending ? "Filtrando…" : "Filtrar"}
            </Button>
          </div>

          {/* Cards */}
          {isPending ? (
            <div className="flex items-center justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl bg-surface-card border border-border-default shadow-card py-16">
              <p className="text-sm text-text-secondary">
                Nenhum dado encontrado para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
              {users.map((u, idx) => (
                <PerformanceCard key={u.userId} user={u} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Abas WIP ── */}
      {(activeTab === "chapters" || activeTab === "horarios" || activeTab === "ferias") && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
