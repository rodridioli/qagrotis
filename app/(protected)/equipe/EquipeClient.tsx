"use client"

import React, { useState, useEffect, useTransition, useMemo } from "react"
import {
  BarChart3, Users, Clock, Calendar,
  SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPerformanceData, type UserPerformanceData } from "@/lib/actions/equipe"
import {
  Select, SelectTrigger, SelectPopup, SelectItem,
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
  name, photoPath, size, ringClass, shape = "circle",
}: { name: string; photoPath: string | null; size: number; ringClass?: string; shape?: "circle" | "square" }) {
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
  const radius = shape === "square" ? "rounded-xl" : "rounded-full"
  const cls = cn(radius, "flex-shrink-0", ringClass)
  if (photoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoPath} alt={name} className={cn(cls, "object-cover")}
        style={{ width: size, height: size }} />
    )
  }
  return (
    <div
      className={cn(cls, "flex items-center justify-center bg-white/20 text-white font-semibold")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </div>
  )
}

// ── Medal config ─────────────────────────────────────────────────────────────

const RANK_BADGE_TOP3 = [
  "bg-amber-400 text-white",
  "bg-slate-400 text-white",
  "bg-orange-400 text-white",
] as const

// ── Compact stat cell ─────────────────────────────────────────────────────────

function StatMini({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-2.5 px-1 gap-0.5">
      <span className={cn("text-base font-bold leading-none text-text-primary", color)}>{value}</span>
      <span className="text-[10px] text-text-secondary text-center leading-tight mt-0.5">{label}</span>
    </div>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-surface-input overflow-hidden">
      <div className="h-full rounded-full bg-brand-primary transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

// ── Performance Card ──────────────────────────────────────────────────────────

function PerformanceCard({ user, rank }: { user: UserPerformanceData; rank: number }) {
  const rankBadgeClass = rank <= 3 ? RANK_BADGE_TOP3[rank - 1]! : "bg-white/20 text-white"

  return (
    <div className="flex flex-col rounded-xl bg-surface-card border border-border-default overflow-hidden">

      {/* ── Header teal ── */}
      <div className="relative px-4 pt-4 pb-3 bg-brand-primary">
        {/* Rank badge — top-right absolute */}
        <span className={cn(
          "absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold leading-none",
          rankBadgeClass,
        )}>
          #{rank}
        </span>

        {/* Avatar — rounded-xl (square-ish) */}
        <UserAvatar
          name={user.name}
          photoPath={user.photoPath}
          size={56}
          shape="square"
        />

        {/* Name + role — white on teal */}
        <div className="mt-2.5 pr-10">
          <p className="text-sm font-bold text-white leading-tight truncate">{user.name}</p>
          <p className="text-xs text-white/70 truncate mt-0.5">
            {user.classificacao ?? <span className="italic opacity-60">Sem classificação</span>}
          </p>
        </div>
      </div>

      {/* ── Sistemas / módulos com atividade (classificação só no cabeçalho) ── */}
      <div className="px-4 py-2.5 border-b border-border-default">
        {user.atividadePorSistema.length > 0 ? (
          <ul className="space-y-1.5 text-xs leading-snug">
            {user.atividadePorSistema.map(({ sistema, modulos }) => (
              <li key={sistema}>
                <span className="font-semibold text-text-primary">{sistema}</span>
                {modulos.length > 0 ? (
                  <>
                    <span className="text-text-secondary"> — </span>
                    <span className="text-text-secondary">{modulos.join(", ")}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-secondary italic">Nenhum sistema/módulo no período filtrado.</p>
        )}
      </div>

      {/* ── Stats 4-column ── */}
      <div className="grid grid-cols-4 divide-x divide-border-default">
        <StatMini label="Cenários" value={user.cenariosCriados}  />
        <StatMini label="Testes"   value={user.testesExecutados} />
        <StatMini label="Sucesso"  value={user.sucessos}         color="text-green-600 dark:text-green-400" />
        <StatMini label="Erros"    value={user.errosEncontrados} color="text-destructive" />
      </div>

      {/* ── Automation bar ── */}
      <div className="px-4 py-2.5 border-t border-border-default">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            Automatizados
          </span>
          <span className="text-xs font-bold text-text-primary">
            {user.testesAutomatizados} de {user.cenariosCriados}{" "}
            <span className="text-[10px] font-normal text-text-secondary">
              ({user.percentualAutomatizado}%)
            </span>
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
  pending, draft, onDraftChange, onApply, onReset,
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
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Sistema</label>
            <Select value={draft.sistema} onValueChange={(v) => setSistema(v ?? "todos")}>
              <SelectTrigger className="w-full">
                <span className="truncate">{draft.sistema === "todos" ? "Todos" : draft.sistema}</span>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="todos">Todos</SelectItem>
                {sistemas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Módulo</label>
            <Select value={draft.modulo} onValueChange={(v) => onDraftChange({ ...draft, modulo: v ?? "todos" })}>
              <SelectTrigger className="w-full">
                <span className="truncate">{draft.modulo === "todos" ? "Todos" : draft.modulo}</span>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="todos">Todos</SelectItem>
                {modulosDisponiveis.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Período</label>
            <Select value={draft.periodo} onValueChange={(v) => onDraftChange({ ...draft, periodo: v ?? "mes-atual" })}>
              <SelectTrigger className="w-full">
                <span className="truncate">
                  {PERIODOS.find((p) => p.value === draft.periodo)?.label ?? draft.periodo}
                </span>
              </SelectTrigger>
              <SelectPopup>
                {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>
        </div>

        <DialogFooter showCloseButton={false}>
          <DialogClose render={<Button variant="ghost" onClick={onReset} />}>
            Limpar filtros
          </DialogClose>
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

  const [draft, setDraft] = useState(DEFAULT_FILTERS)
  const [applied, setApplied] = useState(DEFAULT_FILTERS)

  const [users, setUsers] = useState<UserPerformanceData[]>([])
  const [isPending, startTransition] = useTransition()

  const activeFilterCount = [
    applied.sistema !== "todos",
    applied.modulo  !== "todos",
    applied.periodo !== "mes-atual",
  ].filter(Boolean).length

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
  }, [applied, activeTab])

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
      {/* Tab bar + filter button inline */}
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-0.5 rounded-xl bg-surface-card border border-border-default shadow-card p-1">
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

        {/* Filter icon — matches TableToolbar pattern exactly */}
        {activeTab === "performance" && (
          <button
            type="button"
            onClick={handleOpenFilter}
            aria-label="Abrir filtros"
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
          >
            <SlidersHorizontal className="size-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-primary text-primary-foreground text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Performance ── */}
      {activeTab === "performance" && (
        <div className="space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
