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
import { inativarIntegracoes, type IntegracaoRecord } from "@/lib/actions/integracoes"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface FilterState {
  apenasInativos: boolean
}

interface Props {
  initialIntegracoes: IntegracaoRecord[]
  isAdmin: boolean
}



export default function IntegracoesClient({ initialIntegracoes, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterState>({ apenasInativos: false })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)


  const filtered = useMemo(() => {
    const result = initialIntegracoes.filter((i) => {
      const matchSearch =
        !search ||
        i.id.toLowerCase().includes(search.toLowerCase()) ||
        i.provider.toLowerCase().includes(search.toLowerCase()) ||
        i.model.toLowerCase().includes(search.toLowerCase())

      const matchAtivo = filters.apenasInativos ? !i.active : i.active
      return matchSearch && matchAtivo
    })
    return [...result].sort((a, b) => b.createdAt - a.createdAt)
  }, [search, filters, initialIntegracoes])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = filters.apenasInativos ? 1 : 0
  const hasActiveIntegracoes = initialIntegracoes.some((i) => i.active)
  const showBulkActions = isAdmin && !filters.apenasInativos && hasActiveIntegracoes
  const selectableIds = pageItems.map((i) => i.id)

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === selectableIds.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableIds))
    }
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
      await inativarIntegracoes(inativarIds)
      router.refresh()
      toast.success(
        count === 1
          ? "Integração inativada com sucesso."
          : `${count} integrações inativadas com sucesso.`
      )
    })
  }

  function clearFilters() {
    setPendingFilters({ apenasInativos: false })
    setFilters({ apenasInativos: false })
    setCurrentPage(1)
  }

  function applyFilters() {
    setFilters(pendingFilters)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  const confirmDescription =
    inativarIds.length === 1
      ? `A integração ${inativarIds[0]} será inativada. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} integrações serão inativadas. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes"
            title="Voltar"
            className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Integrações</span>
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
            <Link href="/configuracoes/integracoes/novo">
              <Button>
                <Plus className="size-4" />
                Adicionar Integração
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar integração..."
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Total de integrações"
          totalCount={filtered.length}
          baseCount={initialIntegracoes.length}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma integração cadastrada.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-20" />
                  <col className="w-36" />
                  <col />
                  <col className="w-10" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Provedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Modelo</th>
                    <th className="py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                    >
                      {showBulkActions && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleRow(item.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/configuracoes/integracoes/${item.id}/editar`} className="text-brand-primary hover:underline">
                          {item.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 truncate capitalize text-text-primary">
                        {item.provider}
                      </td>
                      <td className="px-4 py-3 truncate text-text-secondary font-mono text-xs">
                        {item.model}
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        {showBulkActions && item.active ? (
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
                                <Link href={`/configuracoes/integracoes/${item.id}/editar`} className="w-full">
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleInativarSingle(item.id)}
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
          </>
        )}
      </div>

      {/* Filter dialog */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Checkbox
              label="Exibir somente inativas"
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

      {/* Confirm inativação */}
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
