"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { Filter, Search, MoreVertical, Plus, X, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { MOCK_CENARIOS, MODULE_LIST, CLIENT_LIST, type MockCenario } from "@/lib/qagrotis-constants"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

function TipoBadge({ tipo }: { tipo: MockCenario["tipo"] }) {
  if (tipo === "Automatizado") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
        {tipo}
      </span>
    )
  }
  if (tipo === "Manual") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700">
        {tipo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
      {tipo}
    </span>
  )
}

interface FilterState {
  modulo: string
  cliente: string
  tipo: string
  apenasInativos: boolean
}

export default function CenariosPage() {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarId, setInativarId] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    modulo: "",
    cliente: "",
    tipo: "",
    apenasInativos: false,
  })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)

  const filtered = useMemo(() => {
    return MOCK_CENARIOS.filter((c) => {
      const matchSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.scenarioName.toLowerCase().includes(search.toLowerCase())
      const matchModulo = !filters.modulo || c.module === filters.modulo
      const matchCliente = !filters.cliente || c.client === filters.cliente
      const matchTipo = !filters.tipo || c.tipo === filters.tipo
      const matchAtivo = filters.apenasInativos ? !c.active : true
      return matchSearch && matchModulo && matchCliente && matchTipo && matchAtivo
    })
  }, [search, filters])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = [filters.modulo, filters.cliente, filters.tipo, filters.apenasInativos ? "1" : ""].filter(Boolean).length

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
    toast.success("Cenário inativado com sucesso.")
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
          onClick={() => {
            if (selectedIds.size > 0) {
              handleInativar([...selectedIds][0])
            }
          }}
        >
          Inativar
        </Button>
        <Link href="/cenarios/novo">
          <Button>
            <Plus className="size-4" />
            Adicionar Cenário
          </Button>
        </Link>
      </div>

      <div className="rounded-xl bg-surface-card shadow-card">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <span className="text-sm font-medium text-text-primary">
            Total de cenários:{" "}
            <span className="font-bold">{filtered.length.toLocaleString("pt-BR")}</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Buscar por Id e Cenário"
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execuções</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Erros</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Suítes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border-default last:border-0 hover:bg-neutral-grey-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleRow(c.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/cenarios/${c.id}`}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <span className="block truncate text-text-primary">{c.scenarioName}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.module}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.client}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.execucoes}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.erros}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.suites}</td>
                  <td className="px-4 py-3">
                    <TipoBadge tipo={c.tipo} />
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md hover:bg-neutral-grey-100 text-text-secondary"
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem>
                          <Link href={`/cenarios/${c.id}`} className="w-full">
                            Visualizar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleInativar(c.id)}
                        >
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
              <span className="px-2">
                {currentPage} de {totalPages}
              </span>
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
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {MODULE_LIST.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Cliente</label>
              <Select
                value={pendingFilters.cliente}
                onValueChange={(v: string | null) => setPendingFilters((p) => ({ ...p, cliente: v ?? "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {CLIENT_LIST.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Tipo</label>
              <Select
                value={pendingFilters.tipo}
                onValueChange={(v: string | null) => setPendingFilters((p) => ({ ...p, tipo: v ?? "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
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
            O cenário {inativarId} será inativado de forma definitiva e não
            poderá ser recuperado. Caso seja necessário utilizá-lo novamente,
            será preciso cadastrar um novo cenário.
          </p>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setInativarOpen(false)}>
              Cancelar
            </Button>
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
