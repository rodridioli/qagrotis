"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  BarChart3, Users, Clock, Calendar,
  SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getPerformanceData,
  getEquipeListagemCadastro,
  type UserPerformanceData,
  type EquipeUsuarioCadastro,
} from "@/lib/actions/equipe"
import { EquipePerformanceCard } from "@/components/equipe/EquipePerformanceCard"
import { EquipeAniversarioCard } from "@/components/equipe/EquipeAniversarioCard"
import { EquipeHorariosTable } from "@/components/equipe/EquipeHorariosTable"
import { EquipeChaptersSection } from "@/components/equipe/EquipeChaptersSection"
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
  isAdmin: boolean
}

type TabId =
  | "performance"
  | "chapters"
  | "horarios"
  | "ferias"
  | "ausencias"
  | "metas"
  | "aniversarios"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "performance", label: "Performance",       icon: BarChart3 },
  { id: "chapters",   label: "Chapters",           icon: Users     },
  { id: "horarios",   label: "Horários",           icon: Clock     },
  { id: "ferias",     label: "Férias",             icon: Calendar  },
  { id: "ausencias",  label: "Ausências",          icon: Calendar  },
  { id: "metas",      label: "Metas",              icon: BarChart3 },
  { id: "aniversarios", label: "Aniversários",     icon: Users     },
]

const PERIODOS = [
  { value: "hoje",         label: "Hoje"          },
  { value: "mes-atual",    label: "Mês atual"     },
  { value: "mes-anterior", label: "Mês anterior"  },
  { value: "ano",          label: "Ano"           },
]

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDataNascimentoBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
}

/** Mês do aniversário (1–12) a partir de `yyyy-mm-dd`. */
function parseMesNascimento(iso: string): number | null {
  const m = parseInt(iso.split("-")[1] ?? "", 10)
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return m
}

function parseDiaNascimento(iso: string): number {
  const d = parseInt(iso.split("-")[2] ?? "", 10)
  return Number.isFinite(d) ? d : 0
}

/** Cabeçalho do grupo (ex.: Janeiro). */
function tituloMesNascimentoPt(month1to12: number): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month1to12 - 1, 1)),
  )
  return label.length ? label.charAt(0).toUpperCase() + label.slice(1) : String(month1to12)
}

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

export default function EquipeClient({ sistemas, modulosPorSistema, isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("performance")
  const [filterOpen, setFilterOpen] = useState(false)

  const [draft, setDraft] = useState(DEFAULT_FILTERS)
  const [applied, setApplied] = useState(DEFAULT_FILTERS)

  const [users, setUsers] = useState<UserPerformanceData[]>([])
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [performanceError, setPerformanceError] = useState<string | null>(null)

  const [aniversariantes, setAniversariantes] = useState<EquipeUsuarioCadastro[]>([])
  const [comHorario, setComHorario] = useState<EquipeUsuarioCadastro[]>([])
  const [cadastroLoading, setCadastroLoading] = useState(false)
  const [cadastroError, setCadastroError] = useState<string | null>(null)

  const activeFilterCount = [
    applied.sistema !== "todos",
    applied.modulo  !== "todos",
    applied.periodo !== "mes-atual",
  ].filter(Boolean).length

  const aniversariantesPorMes = useMemo(() => {
    const byMonth = new Map<number, EquipeUsuarioCadastro[]>()
    for (const u of aniversariantes) {
      const iso = u.dataNascimentoIso
      if (!iso) continue
      const month = parseMesNascimento(iso)
      if (month == null) continue
      if (!byMonth.has(month)) byMonth.set(month, [])
      byMonth.get(month)!.push(u)
    }
    const months = [...byMonth.keys()].sort((a, b) => a - b)
    return months.map((month) => ({
      month,
      titulo: tituloMesNascimentoPt(month),
      users: (byMonth.get(month) ?? []).sort((a, b) => {
        const da = parseDiaNascimento(a.dataNascimentoIso ?? "")
        const db = parseDiaNascimento(b.dataNascimentoIso ?? "")
        if (da !== db) return da - db
        return a.name.localeCompare(b.name, "pt-BR")
      }),
    }))
  }, [aniversariantes])

  useEffect(() => {
    if (activeTab !== "performance") return
    const { dataInicio, dataFim } = getDateRange(applied.periodo)
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setPerformanceLoading(true)
      setPerformanceError(null)
    })
    getPerformanceData({
      sistema: applied.sistema === "todos" ? undefined : applied.sistema,
      modulo:  applied.modulo  === "todos" ? undefined : applied.modulo,
      dataInicio,
      dataFim,
    })
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([])
          setPerformanceError("Não foi possível carregar os dados de performance. Tente novamente em instantes.")
        }
      })
      .finally(() => {
        if (!cancelled) setPerformanceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applied, activeTab])

  useEffect(() => {
    if (activeTab !== "aniversarios" && activeTab !== "horarios") return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCadastroLoading(true)
      setCadastroError(null)
    })
    getEquipeListagemCadastro()
      .then((data) => {
        if (!cancelled) {
          setAniversariantes(data.aniversariantes)
          setComHorario(data.comHorario)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAniversariantes([])
          setComHorario([])
          setCadastroError("Não foi possível carregar os dados. Tente novamente em instantes.")
        }
      })
      .finally(() => {
        if (!cancelled) setCadastroLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

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
        <div className="flex flex-wrap gap-0.5 rounded-custom border border-border-default bg-surface-card p-1 shadow-card">
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
            pending={performanceLoading}
            draft={draft}
            onDraftChange={setDraft}
            onApply={handleApply}
            onReset={handleReset}
          />

          {performanceLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : performanceError ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
              <p className="text-center text-sm text-destructive">{performanceError}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card">
              <p className="text-sm text-text-secondary">
                Nenhum dado encontrado para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((u, idx) => (
                <EquipePerformanceCard key={u.userId} user={u} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "aniversarios" && (
        <div className="space-y-4">
          {cadastroLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : cadastroError ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
              <p className="text-center text-sm text-destructive">{cadastroError}</p>
            </div>
          ) : aniversariantes.length === 0 ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card">
              <p className="text-sm text-text-secondary">
                Nenhum usuário ativo com data de nascimento cadastrada.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {aniversariantesPorMes.map(({ month, titulo, users }) => (
                <section key={month} aria-labelledby={`mes-aniversario-${month}`} className="space-y-4">
                  <div className="border-b border-border-default pb-2">
                    <h2
                      id={`mes-aniversario-${month}`}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-semibold text-text-primary"
                    >
                      <span className="uppercase tracking-wide text-text-secondary">{titulo}</span>
                      <span className="text-sm font-normal normal-case text-text-secondary">
                        {users.length} {users.length === 1 ? "aniversariante" : "aniversariantes"}
                      </span>
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {users.map((u) => (
                      <EquipeAniversarioCard
                        key={u.userId}
                        name={u.name}
                        classificacao={u.classificacao}
                        photoPath={u.photoPath}
                        dataNascimentoLabel={
                          u.dataNascimentoIso ? formatDataNascimentoBr(u.dataNascimentoIso) : "—"
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "horarios" && (
        <div className="space-y-4">
          {cadastroLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : cadastroError ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
              <p className="text-center text-sm text-destructive">{cadastroError}</p>
            </div>
          ) : (
            <EquipeHorariosTable rows={comHorario} />
          )}
        </div>
      )}

      {activeTab === "chapters" && <EquipeChaptersSection isAdmin={isAdmin} />}

      {(activeTab === "ferias" || activeTab === "ausencias" || activeTab === "metas") && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
