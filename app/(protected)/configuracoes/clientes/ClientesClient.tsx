"use client"

import React, { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, MoreVertical, X, Filter, Power } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { inativarClientes, type ClienteRecord } from "@/lib/actions/clientes"
import { type CenarioRecord } from "@/lib/actions/cenarios"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface Props {
  initialClientes: ClienteRecord[]
  initialCenarios: CenarioRecord[]
  isAdmin: boolean
}

export default function ClientesClient({ initialClientes, initialCenarios, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [apenasInativos, setApenasInativos] = useState(false)
  const [pendingInativos, setPendingInativos] = useState(false)

  const filtered = useMemo(() => {
    const result = initialClientes.filter((c) => {
      const matchSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
        (c.razaoSocial ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.cpfCnpj ?? "").toLowerCase().includes(search.toLowerCase())
      const matchAtivo = apenasInativos ? !c.active : c.active
      return matchSearch && matchAtivo
    })
    return [...result].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [search, apenasInativos, initialClientes])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const sistemasByCliente = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const ce of initialCenarios) {
      if (!ce.active || !ce.system) continue
      const list = map.get(ce.client) ?? []
      if (!list.includes(ce.system)) map.set(ce.client, [...list, ce.system])
    }
    return map
  }, [initialCenarios])

  const activeFilterCount = apenasInativos ? 1 : 0
  const hasActiveClientes = initialClientes.some((c) => c.active)
  const showBulkActions = isAdmin && !apenasInativos && hasActiveClientes
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
      await inativarClientes(inativarIds)
      router.refresh()
      toast.success(
        count === 1 ? "Cliente inativado com sucesso." : `${count} clientes inativados com sucesso.`
      )
    })
  }

  function applyFilters() {
    setApenasInativos(pendingInativos)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  function clearFilters() {
    setPendingInativos(false)
    setApenasInativos(false)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  const confirmDescription =
    inativarIds.length === 1
      ? `O cliente ${inativarIds[0]} será inativado. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} clientes serão inativados. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes"
            title="Voltar" className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Clientes</span>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3">
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
            <Link href="/configuracoes/clientes/novo">
              <Button>
                <Plus className="size-4" />
                Adicionar Cliente
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar cliente..."
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingInativos(apenasInativos); setFilterOpen(true) }}
          totalLabel="Total de clientes"
          totalCount={filtered.length}
          baseCount={initialClientes.length}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-24" />
                  <col />
                  <col className="w-48" />
                  <col className="w-36" />
                  <col className="w-52" />
                  <col className="w-12" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Nome Fantasia</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Razão Social</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">CPF / CNPJ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Sistemas</th>
                    <th className="py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => {
                    const sistemas = sistemasByCliente.get(c.nomeFantasia) ?? []
                    return (
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
                        <td className="px-4 py-3 font-medium text-text-secondary">{c.id}</td>
                        <td className="px-4 py-3 font-medium text-text-primary">{c.nomeFantasia}</td>
                        <td className="px-4 py-3 text-text-secondary truncate">
                          {c.razaoSocial ?? <span className="italic text-text-secondary/60">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-secondary truncate">
                          {c.cpfCnpj ?? <span className="italic text-text-secondary/60">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {sistemas.length === 0 ? (
                            <span className="italic text-text-secondary/60 text-sm">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {sistemas.map((s) => (
                                <span key={s} className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pl-2 pr-4">
                          {showBulkActions && c.active ? (
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
                                  <Link href={`/configuracoes/clientes/${c.id}/editar`} className="w-full">
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
                    )
                  })}
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

      {/* ── Filter dialog ── */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Checkbox
              label="Exibir somente inativos"
              checked={pendingInativos}
              onChange={(e) => setPendingInativos((e.target as HTMLInputElement).checked)}
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
        description={confirmDescription}
        confirmLabel="Inativar"
        onConfirm={confirmInativar}
      />
    </div>
  )
}
