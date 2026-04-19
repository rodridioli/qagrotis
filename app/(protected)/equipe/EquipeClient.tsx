"use client"

import React, { useState, useEffect, useTransition, useMemo } from "react"
import {
  BarChart3, Users, Clock, Calendar,
  Bot, CheckCircle2, XCircle, Layers, Trophy, SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPerformanceData, type UserPerformanceData } from "@/lib/actions/equipe"
import {
  Select, SelectTrigger, SelectValue, SelectPopup, SelectItem,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog"

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  sistemas: string[]
  modulosPorSistema: Record<string, string[]>
}

type TabId = "performance" | "chapters" | "horarios" | "ferias"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "performance", label: "Performance",       icon: BarChart3 },
  { id: "chapters",   label: "Chapters",           icon: Users     },
  { id: "horarios",   label: "Horários",           icon: Clock     },
  { id: "ferias",     label: "Férias e Ausências", icon: Calendar  },
]

const PERIODOS = [
  { value: "hoje",         label: "Hoje"          },
  { value: "mes-atual",    label: "Mês Atual"     },
  { value: "mes-anterior", label: "Mês Anterior"  },
  { value: "ano",          label: "Ano"           },
]

// ── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange(periodo: string): { dataInicio?: string; dataFim?: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)
  switch (periodo) {
    case "hoje":         return { dataInicio: today, dataFim: today }
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
    default: return {}
  }
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({
  name, photoPath, size, ringClass,
}: { name: string; photoPath: string | null; size: number; ringClass?: string }) {
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
  const cls = cn("rounded-full flex-shrink-0", ringClass)
  if (photoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoPath} alt={name} className={cn(cls, "object-cover")}
        style={{ width: size, height: size }} />
    )
  }
  return (
    <div
      className={cn(cls, "flex items-center justify-center bg-brand-primary text-white font-semibold")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {initials}
    </div>
  )
}

// ── Medal config ─────────────────────────────────────────────────────────────

const MEDALS = [
  { headerBg: "bg-amber-50 dark:bg-amber-950/20",  cardBorder: "border-amber-300",  cardShadow: "shadow-[0_4px_24px_0_rgb(251_191_36_/_0.20)]", badgeBg: "bg-amber-400",  ring: "ring-4 ring-amber-400 ring-offset-2 ring-offset-amber-50",  emoji: "🥇", label: "1º lugar", avatarSize: 96 },
  { headerBg: "bg-slate-50 dark:bg-slate-800/30",  cardBorder: "border-slate-300",  cardShadow: "shadow-[0_4px_16px_0_rgb(148_163_184_/_0.18)]", badgeBg: "bg-slate-400",  ring: "ring-4 ring-slate-300 ring-offset-2 ring-offset-slate-50",  emoji: "🥈", label: "2º lugar", avatarSize: 80 },
  { headerBg: "bg-orange-50 dark:bg-orange-950/20", cardBorder: "border-orange-300", cardShadow: "shadow-[0_4px_16px_0_rgb(251_146_60_/_0.18)]",  badgeBg: "bg-orange-500", ring: "ring-4 ring-orange-400 ring-offset-2 ring-offset-orange-50", emoji: "🥉", label: "3º lugar", avatarSize: 72 },
]

// ── Stat cell (ícone com círculo colorido, inspirado na referência) ───────────

function StatCell({ icon, label, value, iconBg, iconColor, valueColor }: {
  icon: React.ElementType; label: string; value: number | string
  iconBg: string; iconColor: string; valueColor?: string
}) {
  const Icon = icon
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-4">
      <div className={cn("flex items-center justify-center size-10 rounded-full", iconBg)}>
        <Icon className={cn("size-5", iconColor)} />
      </div>
      <div className="text-center">
        <p className={cn("text-2xl font-bold leading-none text-text-primary", valueColor)}>{value}</p>
        <p className="text-xs text-text-secondary mt-1">{label}</p>
      </div>
    </div>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-input overflow-hidden">
      <div className="h-full rounded-full bg-brand-primary transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

// ── Performance Card ─────────────────────────────────────────────────────────

function PerformanceCard({ user, rank }: { user: UserPerformanceData; rank: number }) {
  const medal = rank <= 3 ? MEDALS[rank - 1]! : null

  return (
    <div className={cn(
      "flex flex-col rounded-xl bg-surface-card border overflow-hidden",
      medal
        ? `border-2 ${medal.cardBorder} ${medal.cardShadow}`
        : "border-border-default shadow-card",
    )}>
      {/* Header — colorido para top-3, neutro para demais */}
      <div className={cn(
        "flex flex-col items-center gap-3 px-5 pt-5 pb-5",
        medal ? medal.headerBg : "bg-surface-card",
      )}>
        {/* Rank badge — dentro do fluxo, nunca absoluto */}
        {medal ? (
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold text-white shadow",
            medal.badgeBg,
          )}>
            {medal.emoji} {medal.label}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-border-default bg-surface-input px-2.5 py-1 text-xs font-medium text-text-secondary">
            {rank}º lugar
          </span>
        )}

        {/* Avatar */}
        <UserAvatar
          name={user.name}
          photoPath={user.photoPath}
          size={medal?.avatarSize ?? 64}
          ringClass={medal?.ring}
        />

        {/* Nome + classificação */}
        <div className="text-center space-y-0.5">
          <p className="text-base font-bold text-text-primary leading-snug">{user.name}</p>
          <p className="text-sm text-text-secondary">
            {user.classificacao ?? <span className="italic opacity-50">Sem classificação</span>}
          </p>
        </div>
      </div>

      {/* Sistemas */}
      {user.sistemas.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-t border-border-default">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Sistemas</p>
          <div className="flex flex-wrap gap-1">
            {user.sistemas.map((s) => (
              <span key={s} className="rounded-full bg-primary-50 text-brand-primary px-2 py-0.5 text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Métricas 2×2 */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border-default border-t border-border-default">
        <StatCell icon={Layers}        label="Cenários"   value={user.cenariosCriados}    iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600 dark:text-purple-400" />
        <StatCell icon={Trophy}        label="Executados" value={user.testesExecutados}    iconBg="bg-blue-100 dark:bg-blue-900/30"   iconColor="text-blue-600 dark:text-blue-400"   />
        <StatCell icon={CheckCircle2}  label="Sucessos"   value={user.sucessos}            iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" valueColor="text-green-600 dark:text-green-400" />
        <StatCell icon={XCircle}       label="Erros"      value={user.errosEncontrados}    iconBg="bg-red-100 dark:bg-red-900/30"     iconColor="text-red-500"                       valueColor="text-destructive" />
      </div>

      {/* Automação */}
      <div className="px-4 py-3 border-t border-border-default space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="size-4 text-brand-primary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Automatizados</span>
          </div>
          <span className="text-sm font-bold text-text-primary">
            {user.testesAutomatizados}{" "}
            <span className="text-xs font-normal text-text-secondary">({user.percentualAutomatizado}%)</span>
          </span>
        </div>
        <ProgressBar value={user.percentualAutomatizado} />
      </div>
    </div>
  )
}

// ── Filter Modal ─────────────────────────────────────────────────────────────

function FilterModal({
  open, onOpenChange, sistemas, modulosPorSistema,
  pending,
  draft, onDraftChange,
  onApply, onReset,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sistemas: string[]
  modulosPorSistema: Record<string, string[]>
  pending: boolean
  draft: { sistema: string; modulo: string; periodo: string }
  onDraftChange: (v: { sistema: string; modulo: string; periodo: string }) => void
  onApply: () => void
  onReset: () => void
}) {
  const modulosDisponiveis = useMemo<string[]>(() => {
    if (draft.sistema === "todos") return [...new Set(Object.values(modulosPorSistema).flat())]
    return modulosPorSistema[draft.sistema] ?? []
  }, [draft.sistema, modulosPorSistema])

  function setSistema(v: string) {
    onDraftChange({ ...draft, sistema: v, modulo: "todos" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros de Performance</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Sistema */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Sistema</label>
            <Select value={draft.sistema} onValueChange={(v) => setSistema(v ?? "todos")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="todos">Todos</SelectItem>
                {sistemas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>

          {/* Módulo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Módulo</label>
            <Select value={draft.modulo} onValueChange={(v) => onDraftChange({ ...draft, modulo: v ?? "todos" })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="todos">Todos</SelectItem>
                {modulosDisponiveis.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>

          {/* Período */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Período</label>
            <Select value={draft.periodo} onValueChange={(v) => onDraftChange({ ...draft, periodo: v ?? "mes-atual" })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectPopup>
                {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReset}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Limpar filtros
          </button>
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button onClick={() => { onApply(); onOpenChange(false) }} disabled={pending}>
              {pending ? "Aplicando…" : "Aplicar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { sistema: "todos", modulo: "todos", periodo: "mes-atual" }

export default function EquipeClient({ sistemas, modulosPorSistema }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("performance")
  const [filterOpen, setFilterOpen] = useState(false)

  // Draft = o que está no modal ainda não aplicado
  const [draft, setDraft] = useState(DEFAULT_FILTERS)
  // Applied = filtros efetivamente aplicados
  const [applied, setApplied] = useState(DEFAULT_FILTERS)

  const [users, setUsers] = useState<UserPerformanceData[]>([])
  const [isPending, startTransition] = useTransition()

  // Badge de filtros ativos
  const activeFilterCount = [
    applied.sistema !== "todos",
    applied.modulo  !== "todos",
    applied.periodo !== "mes-atual",
  ].filter(Boolean).length

  // Fetch ao mudar applied ou aba
  useEffect(() => {
    if (activeTab !== "performance") return
    const { dataInicio, dataFim } = getDateRange(applied.periodo)
    startTransition(async () => {
      const data = await getPerformanceData({
        sistema:    applied.sistema === "todos" ? undefined : applied.sistema,
        modulo:     applied.modulo  === "todos" ? undefined : applied.modulo,
        dataInicio,
        dataFim,
      })
      setUsers(data)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, activeTab])

  // Ao abrir o modal, sincronizar draft com applied
  function handleOpenFilter() {
    setDraft(applied)
    setFilterOpen(true)
  }

  function handleApply() {
    setApplied(draft)
  }

  function handleReset() {
    setDraft(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
    setFilterOpen(false)
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

      {/* ── Performance ── */}
      {activeTab === "performance" && (
        <div className="space-y-5">
          {/* Cabeçalho com botão de filtro */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Performance</h2>
            <button
              type="button"
              onClick={handleOpenFilter}
              className="relative flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm font-medium text-text-secondary shadow-card transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
            >
              <SlidersHorizontal className="size-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Modal de filtros */}
          <FilterModal
            open={filterOpen}
            onOpenChange={setFilterOpen}
            sistemas={sistemas}
            modulosPorSistema={modulosPorSistema}
            pending={isPending}
            draft={draft}
            onDraftChange={setDraft}
            onApply={handleApply}
            onReset={handleReset}
          />

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
