"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal, Plus, MoreVertical, X, Filter, Calendar } from "lucide-react"
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
import { MOCK_SUITES, MODULE_LIST, CLIENT_LIST, type MockSuite } from "@/lib/qagrotis-constants"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

function AutomacaoBadge({ pct }: { pct: number }) {
  let cls = "bg-red-100 text-red-700"
  if (pct === 100) cls = "bg-green-100 text-green-700"
  else if (pct >= 50) cls = "bg-yellow-100 text-yellow-700"
  else if (pct > 0) cls = "bg-orange-100 text-orange-700"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {pct}%
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: MockSuite["tipo"] }) {
  const map: Record<string, string> = {
    Sprint: "bg-green-100 text-green-700",
    Kanban: "bg-primary-100 text-primary-700",
    Outro: "bg-orange-100 text-orange-700",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[tipo]}`}>
      {tipo}
    </span>
  )
}

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
      const matchSearch = !search ||
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

  const activeFilterCount = [filters.modulo, filters.tipo, filters.apenasInativos ? "1" : ""].filter(Boolean).length

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <span className="text-sm font-medium text-text-primary">
            Suítes de teste:{" "}
            <span className="font-bold">{filtered.length.toLocaleString("pt-BR")}</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Buscar por Id e Suíte"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="h-9 rounded-custom border border-border-default bg-surface-input pl-9 pr-3 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 placeholder:text-text-secondary w-64"
              />
            </div>
            <button
              type="button"
              onClick={() => { setPendingFilters(filters); setFilterOpen(true) }}
              className="relative flex items-center justify-center size-9 rounded-lg border border-border-default bg-surface-input text-text-secondary hover:bg-neutral-grey-100 transition-colors"
            >
              <SlidersHorizontal className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-primary text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center justify-center size-9 rounded-lg border border-border-default bg-surface-input text-text-secondary hover:bg-neutral-grey-100 transition-colors"
            >
              <Calendar className="size-4" />
            </button>
          </div>
        </div>

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
              {pageItems.map((s) => (
                <tr key={s.id} className="border-b border-border-default last:border-0 hover:bg-neutral-grey-50 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox checked={selectedIds.has(s.id)} onChange={() => toggleRow(s.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-text-secondary">{s.id}</td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <Link href={`/suites/${s.id}`} className="block truncate font-medium text-brand-primary hover:underline">
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
                  <td className="px-4 py-3"><TipoBadge tipo={s.tipo} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" className="flex size-7 items-center justify-center rounded-md hover:bg-neutral-grey-100 text-text-secondary" />
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

        <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Itens por página:</span>
            <span className="font-medium">10</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <span>
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de{" "}
              {filtered.length} items
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="flex size-7 items-center justify-center rounded-md border border-border-default disabled:opacity-40 hover:bg-neutral-grey-100"
              >
                &lt;
              </button>
              <span className="px-2">{currentPage} de {totalPages}</span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="flex size-7 items-center justify-center rounded-md border border-border-default disabled:opacity-40 hover:bg-neutral-grey-100"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
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
                onValueChange={(v: string | null) => setPendingFilters((p) => ({ ...p, modulo: v ?? "" }))}
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
                onValueChange={(v: string | null) => setPendingFilters((p) => ({ ...p, tipo: v ?? "" }))}
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
                setPendingFilters((p) => ({ ...p, apenasInativos: (e.target as HTMLInputElement).checked }))
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

      <Dialog open={inativarOpen} onOpenChange={setInativarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deseja inativar?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            A suíte {inativarId} será inativada de forma definitiva e não poderá ser recuperada.
          </p>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setInativarOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmInativar}
            >
              Inativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
