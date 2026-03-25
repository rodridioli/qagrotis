"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Filter, Plus, X, Calendar, MoreVertical } from "lucide-react"
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
import { AutomacaoBadge, SuiteTipoBadge } from "@/components/qagrotis/StatusBadge"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { MOCK_SUITES, MODULE_LIST } from "@/lib/qagrotis-constants"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface FilterState {
  modulo: string
  tipo: string
  apenasInativos: boolean
}

export default function SuitesPage() {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarId, setInativarId] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({ modulo: "", tipo: "", apenasInativos: false })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)

  const filtered = useMemo(() => {
    return MOCK_SUITES.filter((s) => {
      const matchSearch =
        !search ||
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.suiteName.toLowerCase().includes(search.toLowerCase())
      const matchModulo = !filters.modulo || s.modulo === filters.modulo
      const matchTipo = !filters.tipo || s.tipo === filters.tipo
      const matchAtivo = filters.apenasInativos ? !s.active : true
      return matchSearch && matchModulo && matchTipo && matchAtivo
    })
  }, [search, filters])

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

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === pageItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pageItems.map((i) => i.id)))
    }
  }

  function handleInativar(id: string) {
    setInativarId(id)
    setInativarOpen(true)
  }

  function confirmInativar() {
    setInativarOpen(false)
    toast.success("Suíte inativada com sucesso.")
    setInativarId(null)
  }

  function applyFilters() {
    setFilters(pendingFilters)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  const calendarButton = (
    <button
      type="button"
      className="flex size-9 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
    >
      <Calendar className="size-4" />
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={selectedIds.size === 0}
          onClick={() => { if (selectedIds.size > 0) handleInativar([...selectedIds][0]) }}
        >
          Inativar
        </Button>
        <Link href="/suites/nova">
          <Button>
            <Plus className="size-4" />
            Adicionar Suite
          </Button>
        </Link>
      </div>

      <div className="rounded-xl bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar por Id e Suíte"
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Suítes de teste"
          totalCount={filtered.length}
          extra={calendarButton}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-neutral-grey-50">
                <th className="px-4 py-3 text-left">
                  <Checkbox
                    checked={pageItems.length > 0 && selectedIds.size === pageItems.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Id</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Suíte</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Versão</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execuções</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Automação</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Erros</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenários</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : pageItems.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                >
                  <td className="px-4 py-3">
                    <Checkbox checked={selectedIds.has(s.id)} onChange={() => toggleRow(s.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-text-secondary">{s.id}</td>
                  <td className="px-4 py-3 max-w-45">
                    <Link
                      href={`/suites/${s.id}`}
                      className="block truncate font-medium text-brand-primary hover:underline"
                    >
                      {s.suiteName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.versao}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.modulo}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.cliente}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.execucoes}</td>
                  <td className="px-4 py-3"><AutomacaoBadge pct={s.automacao} /></td>
                  <td className="px-4 py-3 text-text-secondary">{s.erros}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.cenarios}</td>
                  <td className="px-4 py-3"><SuiteTipoBadge tipo={s.tipo} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem>
                          <Link href={`/suites/${s.id}`} className="w-full">Visualizar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleInativar(s.id)}>
                          Inativar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              >
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {MODULE_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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
            <Button variant="outline" onClick={() => setFilterOpen(false)}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button onClick={applyFilters}>
              <Filter className="size-4" />
              Filtrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={inativarOpen}
        onOpenChange={setInativarOpen}
        title="Deseja inativar?"
        description={`A suíte ${inativarId} será inativada de forma definitiva e não poderá ser recuperada.`}
        confirmLabel="Inativar"
        onConfirm={confirmInativar}
      />
    </div>
  )
}
