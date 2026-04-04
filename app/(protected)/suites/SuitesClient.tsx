"use client"

import { useState, useMemo, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Filter, Plus, Power, X, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { SuiteTipoBadge } from "@/components/qagrotis/StatusBadge"
import type { SuiteTipo } from "@/lib/qagrotis-constants"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"
import { inativarSuites, type SuiteListRecord } from "@/lib/actions/suites"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface FilterState {
  modulo: string
  tipo: string
  apenasInativos: boolean
}

const EMPTY_FILTERS: FilterState = { modulo: "", tipo: "", apenasInativos: false }

function AutomacaoBar({ pct }: { pct: number }) {
  const fillClass =
    pct === 100 ? "bg-green-600 dark:bg-green-500" :
    pct === 0   ? "" :
                  "bg-orange-500"

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-neutral-grey-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-text-secondary">{pct}%</span>
    </div>
  )
}

interface Props {
  allModulos: ModuloRecord[]
  suites: SuiteListRecord[]
}

export default function SuitesClient({ allModulos, suites }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { sistemaSelecionado } = useSistemaSelecionado()

  const modulosDosistema = useMemo(
    () => allModulos.filter((m) => m.sistemaName === sistemaSelecionado).map((m) => m.name),
    [allModulos, sistemaSelecionado]
  )

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [inativadosIds, setInativadosIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [pendingFilters, setPendingFilters] = useState<FilterState>(EMPTY_FILTERS)

  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [sistemaSelecionado])

  const modulosDosistemaSet = useMemo(
    () => new Set(modulosDosistema),
    [modulosDosistema]
  )

  const filtered = useMemo(() => {
    return suites.filter((s) => {
      if (inativadosIds.has(s.id)) return false
      const matchSistema = modulosDosistema.length === 0 || modulosDosistemaSet.has(s.modulo)
      const matchSearch =
        !search ||
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.suiteName.toLowerCase().includes(search.toLowerCase())
      const matchModulo = !filters.modulo || s.modulo === filters.modulo
      const matchTipo = !filters.tipo || s.tipo === filters.tipo
      const matchAtivo = filters.apenasInativos ? !s.active : s.active
      return matchSistema && matchSearch && matchModulo && matchTipo && matchAtivo
    })
  }, [suites, search, filters, modulosDosistema, modulosDosistemaSet, inativadosIds])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = [
    filters.modulo,
    filters.tipo,
    filters.apenasInativos ? "1" : "",
  ].filter(Boolean).length

  const showBulkActions = !filters.apenasInativos
  const selectableIds = pageItems.map((s) => s.id)

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === selectableIds.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(selectableIds))
  }

  function handleInativarSelection() {
    if (selectedIds.size === 0) return
    setInativarIds([...selectedIds])
    setInativarOpen(true)
  }

  function handleInativarSingle(id: string) {
    setInativarIds([id])
    setInativarOpen(true)
  }

  function confirmInativar() {
    const ids = inativarIds
    const count = ids.length
    // Optimistic update
    setInativadosIds((prev) => new Set([...prev, ...ids]))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setInativarIds([])
    setInativarOpen(false)
    startTransition(async () => {
      try {
        await inativarSuites(ids)
        router.refresh()
        toast.success(count === 1 ? "Suíte inativada com sucesso." : `${count} suítes inativadas com sucesso.`)
      } catch {
        // Rollback optimistic update
        setInativadosIds((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.delete(id))
          return next
        })
        router.refresh()
        toast.error("Erro ao inativar. Tente novamente.")
      }
    })
  }

  function applyFilters() {
    setFilters(pendingFilters)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  function clearFilters() {
    setPendingFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {showBulkActions && (
          <Button
            variant="outline"
            disabled={selectedIds.size === 0}
            onClick={handleInativarSelection}
          >
            <Power className="size-4" />
            Inativar
          </Button>
        )}
        <Link href="/suites/nova">
          <Button>
            <Plus className="size-4" />
            Adicionar Suite
          </Button>
        </Link>
      </div>

      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar por Código e Suíte"
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Suítes de teste"
          totalCount={filtered.length}
          baseCount={modulosDosistema.length === 0 ? suites.length : suites.filter((s) => modulosDosistemaSet.has(s.modulo)).length}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-215 table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-20" />
                  <col />
                  <col className="w-14" />
                  <col className="w-28" />
                  <col className="w-16" />
                  <col className="w-32" />
                  <col className="w-12" />
                  <col className="w-14" />
                  <col className="w-24" />
                  {showBulkActions && <col className="w-16" />}
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    {showBulkActions && (
                      <th className="px-4 py-3 text-left">
                        <Checkbox
                          checked={selectableIds.length > 0 && selectedIds.size === selectableIds.length}
                          onChange={toggleAll}
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Suíte</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Versão</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Execuções</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Automação</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Erros</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Cenários</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    {showBulkActions && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                    >
                      {showBulkActions && (
                        <td className="px-4 py-3">
                          <Checkbox checked={selectedIds.has(s.id)} onChange={() => toggleRow(s.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/suites/${s.id}`} className="text-brand-primary hover:underline">
                          {s.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 truncate font-medium text-text-primary">{s.suiteName}</td>
                      <td className="px-4 py-3 text-text-secondary">{s.versao}</td>
                      <td className="px-4 py-3 text-text-secondary truncate">{s.modulo}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                        {s.historicoCount}
                      </td>
                      <td className="px-4 py-3">
                        <AutomacaoBar pct={s.cenarios.length === 0 ? 0 : Math.round(s.cenarios.filter((c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto.").length / s.cenarios.length * 100)} />
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                        {s.historicoErros}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{s.cenarios.length}</td>
                      <td className="px-4 py-3">
                        <SuiteTipoBadge tipo={s.tipo as SuiteTipo} />
                      </td>
                      {showBulkActions && (
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                                />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom">
                              <DropdownMenuItem>
                                <Link href={`/suites/${s.id}`} className="w-full">Visualizar</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => handleInativarSingle(s.id)}>
                                Inativar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Módulo</label>
              <Select
                value={pendingFilters.modulo}
                onValueChange={(v: string | null) =>
                  setPendingFilters((p) => ({ ...p, modulo: v ?? "" }))
                }
                disabled={modulosDosistema.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={modulosDosistema.length === 0 ? "Nenhum módulo cadastrado" : "Todos"} />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {modulosDosistema.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Tipo</label>
              <Select
                value={pendingFilters.tipo}
                onValueChange={(v: string | null) =>
                  setPendingFilters((p) => ({ ...p, tipo: v ?? "" }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="Sprint">Sprint</SelectItem>
                  <SelectItem value="Kanban">Kanban</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectPopup>
              </Select>
            </div>
            <Checkbox
              label="Exibir somente inativos"
              checked={pendingFilters.apenasInativos}
              onChange={(e) =>
                setPendingFilters((p) => ({
                  ...p,
                  apenasInativos: (e.target as HTMLInputElement).checked,
                }))
              }
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="ghost" onClick={clearFilters} />}>
              Limpar filtros
            </DialogClose>
            <div className="flex gap-2">
              <DialogClose render={<Button variant="outline" />}>
                <X className="size-4" />
                Cancelar
              </DialogClose>
              <Button onClick={applyFilters}>
                <Filter className="size-4" />
                Filtrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={inativarOpen}
        onOpenChange={setInativarOpen}
        title="Deseja inativar?"
        description={
          inativarIds.length === 1
            ? `A suíte ${inativarIds[0]} será inativada de forma definitiva e não poderá ser recuperada.`
            : `${inativarIds.length} suítes serão inativadas de forma definitiva e não poderão ser recuperadas.`
        }
        confirmLabel="Inativar"
        onConfirm={confirmInativar}
      />
    </div>
  )
}
