"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { FeriasSituacaoBadge, type FeriasSituacao } from "@/components/shared/StatusBadge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { listAllFerias, type IndividualFeriasRow } from "@/features/individual/actions/individual-ferias"

// ── Types ─────────────────────────────────────────────────────────────────────

type SituacaoFiltro = "ativas" | "planejada" | "em_andamento" | "concluida" | "todas"

type RowWithSituacao = IndividualFeriasRow & { situacao: FeriasSituacao }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoToBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function calcRetornoIso(inicioIso: string, dias: number): string {
  const d = new Date(inicioIso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function formatCodigo(codigo: number): string {
  return `FER-${String(codigo).padStart(3, "0")}`
}

function computeSituacao(inicioIso: string, dias: number): FeriasSituacao {
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const [y, m, d] = inicioIso.split("-").map(Number)
  const inicioUtc = Date.UTC(y!, m! - 1, d!)
  const retornoUtc = inicioUtc + dias * 86400000
  if (inicioUtc > todayUtc) return "planejada"
  if (retornoUtc > todayUtc) return "em_andamento"
  return "concluida"
}

function matchesSituacaoFiltro(situacao: FeriasSituacao, filtro: SituacaoFiltro): boolean {
  if (filtro === "todas") return true
  if (filtro === "ativas") return situacao === "planejada" || situacao === "em_andamento"
  return situacao === filtro
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTRO: SituacaoFiltro = "ativas"

const SITUACAO_OPTIONS: { value: SituacaoFiltro; label: string }[] = [
  { value: "todas",        label: "Todas" },
  { value: "planejada",    label: "Planejada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida",    label: "Concluída" },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function EquipeFeriasSection() {
  const [rows, setRows] = React.useState<IndividualFeriasRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [situacaoFiltro, setSituacaoFiltro] = React.useState<SituacaoFiltro>(DEFAULT_FILTRO)
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [filterDraft, setFilterDraft] = React.useState<SituacaoFiltro>(DEFAULT_FILTRO)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listAllFerias())
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar as férias.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void refetch() }, [refetch])

  const rowsWithSituacao = React.useMemo<RowWithSituacao[]>(
    () => rows.map((r) => ({ ...r, situacao: computeSituacao(r.inicioIso, r.dias) })),
    [rows],
  )

  const filtered = React.useMemo<RowWithSituacao[]>(() => {
    return rowsWithSituacao
      .filter((r) => {
        if (!matchesSituacaoFiltro(r.situacao, situacaoFiltro)) return false
        if (!search.trim()) return true
        const q = search.trim().toLowerCase()
        return (
          formatCodigo(r.codigo).toLowerCase().includes(q) ||
          formatIsoToBr(r.inicioIso).includes(q) ||
          (r.evaluatedUser?.name ?? "").toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.inicioIso.localeCompare(b.inicioIso))
  }, [rowsWithSituacao, situacaoFiltro, search])

  const activeFilterCount = situacaoFiltro !== DEFAULT_FILTRO ? 1 : 0

  if (loading) return <SectionSpinner minHeight="min-h-[16rem]" />

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por usuário…"
          totalLabel="Total de férias"
          totalCount={rows.length}
          baseCount={rows.length}
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => {
            setFilterDraft(situacaoFiltro)
            setFilterOpen(true)
          }}
        />

        {error ? (
          <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="qagrotis-table-row-hover-muted w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Início</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Usuário</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Dias</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Retorno</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const retornoIso = calcRetornoIso(row.inicioIso, row.dias)
                  const userName = row.evaluatedUser?.name ?? "Usuário"
                  const initials = getInitials(userName)
                  return (
                    <tr key={row.id} className="border-b border-border-default last:border-b-0 transition-colors">
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                        {formatIsoToBr(row.inicioIso)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            {row.evaluatedUser?.photoPath ? (
                              <AvatarImage src={row.evaluatedUser.photoPath} alt={userName} />
                            ) : null}
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-text-primary">{userName}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                        {row.dias}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                        {formatIsoToBr(retornoIso)}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <FeriasSituacaoBadge situacao={row.situacao} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter dialog */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Situação</label>
              <Select
                value={filterDraft}
                onValueChange={(v) => setFilterDraft(v as SituacaoFiltro)}
                aria-label="Filtrar por situação"
              >
                <SelectTrigger>
                  <SelectValue>
                    {SITUACAO_OPTIONS.find((o) => o.value === filterDraft)?.label ?? "Selecione..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {SITUACAO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSituacaoFiltro(DEFAULT_FILTRO)
                setFilterDraft(DEFAULT_FILTRO)
                setFilterOpen(false)
              }}
            >
              Limpar filtros
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setFilterOpen(false)}
            >
              <X className="size-4 shrink-0" />
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => {
                setSituacaoFiltro(filterDraft)
                setFilterOpen(false)
              }}
            >
              <Check className="size-4 shrink-0" />
              Filtrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
