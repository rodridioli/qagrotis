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
import { inativarSistemas, type SistemaRecord } from "@/lib/actions/sistemas"
import { type ModuloRecord } from "@/lib/actions/modulos"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface FilterState {
  apenasInativos: boolean
}

interface Props {
  initialSistemas: SistemaRecord[]
  initialModulos: ModuloRecord[]
  isAdmin: boolean
}

export default function SistemasClient({ initialSistemas, initialModulos, isAdmin }: Props) {
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
  const [modulosModalSistema, setModulosModalSistema] = useState<SistemaRecord | null>(null)

  const filtered = useMemo(() => {
    const result = initialSistemas.filter((s) => {
      const matchSearch =
        !search ||
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description ?? "").toLowerCase().includes(search.toLowerCase())
      const matchAtivo = filters.apenasInativos ? !s.active : s.active
      return matchSearch && matchAtivo
    })
    return [...result].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [search, filters, initialSistemas])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = filters.apenasInativos ? 1 : 0
  const hasActiveSistemas = initialSistemas.some((s) => s.active)
  const showBulkActions = isAdmin && !filters.apenasInativos && hasActiveSistemas
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
      try {
        await inativarSistemas(inativarIds)
        router.refresh()
        toast.success(
          count === 1
            ? "Sistema inativado com sucesso."
            : `${count} sistemas inativados com sucesso.`
        )
      } catch {
        router.refresh()
        toast.error("Erro ao inativar. Tente novamente.")
      }
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
      ? `O sistema ${inativarIds[0]} será inativado. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} sistemas serão inativados. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes"
            title="Voltar"
            aria-label="Voltar"
            className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Sistemas</span>
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
            <Link href="/configuracoes/sistemas/novo">
              <Button>
                <Plus className="size-4" />
                Adicionar Sistema
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
          searchPlaceholder="Buscar sistema..."
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Total de sistemas"
          totalCount={filtered.length}
          baseCount={initialSistemas.length}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-20" />
                  <col />
                  <col className="w-44" />
                  <col className="w-20" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    {showBulkActions && (
                      <th className="sticky left-0 z-20 bg-neutral-grey-50 px-4 py-3 text-left">
                        <Checkbox
                          checked={selectableIds.length > 0 && selectedIds.size === selectableIds.length}
                          onChange={toggleAll}
                        />
                      </th>
                    )}
                    <th className={cn(
                      "sticky z-20 bg-neutral-grey-50 px-4 py-3 text-left text-xs font-semibold text-text-secondary",
                      showBulkActions ? "left-10" : "left-0"
                    )}>Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Descrição</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Módulos</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((s) => {
                    const modulosDoSistema = initialModulos.filter((m) => m.sistemaId === s.id && m.active)
                    return (
                      <tr
                        key={s.id}
                        className="group border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                      >
                        {showBulkActions && (
                          <td className="sticky left-0 z-10 bg-surface-card px-4 py-3 group-hover:bg-neutral-grey-50">
                            <Checkbox
                              checked={selectedIds.has(s.id)}
                              onChange={() => toggleRow(s.id)}
                            />
                          </td>
                        )}
                        <td className={cn(
                          "sticky z-10 bg-surface-card px-4 py-3 font-medium whitespace-nowrap group-hover:bg-neutral-grey-50",
                          showBulkActions ? "left-10" : "left-0"
                        )}>
                          {s.active && isAdmin ? (
                            <Link href={`/configuracoes/sistemas/${s.id}/editar`} className="text-brand-primary hover:underline">{s.id}</Link>
                          ) : (
                            <span>{s.id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary truncate" title={s.name}>{s.name}</td>
                        <td className="px-4 py-3 text-text-secondary truncate" title={s.description ?? undefined}>
                          {s.description ?? <span className="italic text-text-secondary/60">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {modulosDoSistema.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setModulosModalSistema(s)}
                              className="text-brand-primary hover:underline text-sm font-medium"
                              title={`Ver ${modulosDoSistema.length} módulo${modulosDoSistema.length !== 1 ? "s" : ""}`}
                              aria-label={`Ver ${modulosDoSistema.length} módulo${modulosDoSistema.length !== 1 ? "s" : ""} de ${s.name}`}
                            >
                              {modulosDoSistema.length}
                            </button>
                          ) : (
                            <span className="text-text-secondary/60 italic text-sm">0</span>
                          )}
                        </td>
                        <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 group-hover:bg-neutral-grey-50">
                          {showBulkActions && s.active ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    aria-label="Mais ações"
                                    className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                                  />
                                }
                              >
                                <MoreVertical className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="bottom">
                                <DropdownMenuItem>
                                  <Link href={`/configuracoes/sistemas/${s.id}/editar`} className="w-full">
                                    Editar
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleInativarSingle(s.id)}
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

      {/* ── Confirm inativação ── */}
      <ConfirmDialog
        open={inativarOpen}
        onOpenChange={setInativarOpen}
        title="Deseja inativar?"
        description={confirmDescription}
        confirmLabel="Inativar"
        onConfirm={confirmInativar}
      />

      {/* ── Módulos do sistema ── */}
      <Dialog open={!!modulosModalSistema} onOpenChange={(open) => { if (!open) setModulosModalSistema(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Módulos — {modulosModalSistema?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1 max-h-80 overflow-y-auto">
            {modulosModalSistema && initialModulos.filter((m) => m.sistemaId === modulosModalSistema.id && m.active).length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-4">Nenhum módulo cadastrado.</p>
            ) : modulosModalSistema && initialModulos.filter((m) => m.sistemaId === modulosModalSistema.id && m.active).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">{m.name}</p>
                  {m.description && <p className="text-xs text-text-secondary">{m.description}</p>}
                </div>
                <span className="text-xs text-text-secondary">{m.id}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
