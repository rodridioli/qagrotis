"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Filter, MoreVertical, Plus, Power, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
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
import { CenarioTipoBadge } from "@/components/qagrotis/StatusBadge"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { inativarCenarios, type CenarioRecord } from "@/lib/actions/cenarios"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { ClienteRecord } from "@/lib/actions/clientes"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface FilterState {
  modulo: string
  cliente: string
  tipo: string
  apenasInativos: boolean
}

interface Props {
  initialCenarios: CenarioRecord[]
  allModulos: ModuloRecord[]
  initialClientes: ClienteRecord[]
}

export default function CenariosClient({ initialCenarios, allModulos, initialClientes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { sistemaSelecionado } = useSistemaSelecionado()

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterState>({
    modulo: "",
    cliente: "",
    tipo: "",
    apenasInativos: false,
  })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)

  const modulosDosistema = allModulos
    .filter((m) => m.sistemaName === sistemaSelecionado)
    .map((m) => m.name)

  const clienteNames = initialClientes.map((c) => c.nomeFantasia)

  const filtered = useMemo(() => {
    const result = initialCenarios.filter((c) => {
      const matchSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.scenarioName.toLowerCase().includes(search.toLowerCase())
      const matchSistema = !sistemaSelecionado || c.system === sistemaSelecionado
      const matchModulo = !filters.modulo || c.module === filters.modulo
      const matchCliente = !filters.cliente || c.client === filters.cliente
      const matchTipo = !filters.tipo || c.tipo === filters.tipo
      const matchAtivo = filters.apenasInativos ? !c.active : c.active
      return matchSearch && matchSistema && matchModulo && matchCliente && matchTipo && matchAtivo
    })
    return [...result].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [search, filters, sistemaSelecionado, initialCenarios])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = [
    filters.modulo,
    filters.cliente,
    filters.tipo,
    filters.apenasInativos ? "1" : "",
  ].filter(Boolean).length

  const hasActiveCenarios = initialCenarios.some((c) => c.active)
  const showBulkActions = !filters.apenasInativos && hasActiveCenarios
  const selectableIds = pageItems.map((c) => c.id)

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
    const count = inativarIds.length
    setInativarOpen(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      inativarIds.forEach((id) => next.delete(id))
      return next
    })
    setInativarIds([])

    startTransition(async () => {
      await inativarCenarios(inativarIds)
      router.refresh()
      toast.success(
        count === 1
          ? "Cenário inativado com sucesso."
          : `${count} cenários inativados com sucesso.`
      )
    })
  }

  function applyFilters() {
    setFilters(pendingFilters)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  const confirmDescription =
    inativarIds.length === 1
      ? `O cenário ${inativarIds[0]} será inativado. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} cenários serão inativados. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {showBulkActions && (
          <Button
            variant="outline"
            disabled={selectedIds.size === 0 || isPending}
            onClick={handleInativarSelection}
          >
            <Power className="size-4" />
            Inativar
          </Button>
        )}
        <Link href="/cenarios/novo">
          <Button>
            <Plus className="size-4" />
            Adicionar Cenário
          </Button>
        </Link>
      </div>

      {/* ── Table card ── */}
      <div className="rounded-xl bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar por Id e Cenário"
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Total de cenários"
          totalCount={filtered.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              {showBulkActions && <col className="w-10" />}
              <col className="w-24" />
              <col />
              <col className="w-1/5" />
              <col className="w-1/6" />
              <col className="w-20" />
              <col className="w-16" />
              <col className="w-16" />
              <col className="w-28" />
              <col className="w-16" />
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Id</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execuções</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Erros</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Suítes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                <th className="pl-4 pr-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={showBulkActions ? 10 : 9} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : pageItems.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                >
                  {showBulkActions && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleRow(c.id)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`/cenarios/${c.id}/editar`} className="font-medium text-brand-primary hover:underline">
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block truncate text-text-primary">{c.scenarioName}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary truncate">{c.module}</td>
                  <td className="px-4 py-3 text-text-secondary truncate">{c.client}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.execucoes}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.erros}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.suites}</td>
                  <td className="px-4 py-3">
                    <CenarioTipoBadge tipo={c.tipo as "Automatizado" | "Manual" | "Man./Auto."} />
                  </td>
                  <td className="pl-4 pr-6 py-3">
                    {showBulkActions && c.active ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className="flex size-9 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom">
                          <DropdownMenuItem>
                            <Link href={`/cenarios/${c.id}/editar`} className="w-full">
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleInativarSingle(c.id)}
                          >
                            Inativar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </td>
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
      </div>

      {/* ── Filter dialog ── */}
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
                <SelectTrigger><SelectValue placeholder={modulosDosistema.length === 0 ? "Nenhum módulo cadastrado" : "Todos"} /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {modulosDosistema.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Cliente</label>
              <Select
                value={pendingFilters.cliente}
                onValueChange={(v: string | null) =>
                  setPendingFilters((p) => ({ ...p, cliente: v ?? "" }))
                }
                disabled={clienteNames.length === 0}
              >
                <SelectTrigger><SelectValue placeholder={clienteNames.length === 0 ? "Nenhum cliente cadastrado" : "Todos"} /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {clienteNames.map((cl) => (
                    <SelectItem key={cl} value={cl}>{cl}</SelectItem>
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
                  <SelectItem value="Automatizado">Automatizado</SelectItem>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Man./Auto.">Man./Auto.</SelectItem>
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
            <Button
              variant="ghost"
              onClick={() => setPendingFilters({ modulo: "", cliente: "", tipo: "", apenasInativos: false })}
            >
              Limpar filtros
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFilterOpen(false)}>
                <X className="size-4" />
                Cancelar
              </Button>
              <Button onClick={applyFilters}>
                <Filter className="size-4" />
                Filtrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm inativação ── */}
      <ConfirmDialog
        open={inativarOpen}
        onOpenChange={setInativarOpen}
        title="Deseja inativar?"
        description={confirmDescription}
        confirmLabel="Inativar"
        onConfirm={confirmInativar}
      />
    </div>
  )
}
