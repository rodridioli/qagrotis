"use client"

import React, { useEffect, useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, MoreVertical, X, Filter, Power, Check } from "lucide-react"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
import { inativarClientes, criarCliente, atualizarCliente, type ClienteRecord } from "@/lib/actions/clientes"
import { type CenarioRecord } from "@/lib/actions/cenarios"
import { cn, formatCpfCnpj, validateCpfCnpj } from "@/lib/utils"
import { StatusBadge } from "@/components/qagrotis/StatusBadge"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 20

function numericId(id: string): number {
  const m = id.match(/\d+$/)
  return m ? parseInt(m[0], 10) : 0
}

interface Props {
  initialClientes: ClienteRecord[]
  initialCenarios: CenarioRecord[]
  isAdmin: boolean
}

export default function ClientesClient({ initialClientes: initialClientesParam, initialCenarios, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localClientes, setLocalClientes] = useState(initialClientesParam)
  useEffect(() => { setLocalClientes(initialClientesParam) }, [initialClientesParam])
  const [isInativando, setIsInativando] = useState(false)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [apenasInativos, setApenasInativos] = useState(false)
  const [pendingInativos, setPendingInativos] = useState(false)

  // ── Edit cliente modal ─────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<ClienteRecord | null>(null)
  const [editNomeFantasia, setEditNomeFantasia] = useState("")
  const [editRazaoSocial, setEditRazaoSocial] = useState("")
  const [editCpfCnpj, setEditCpfCnpj] = useState("")
  const [isEditPending, startEditTransition] = useTransition()

  function openEditarCliente(c: ClienteRecord) {
    setEditingCliente(c)
    setEditNomeFantasia(c.nomeFantasia)
    setEditRazaoSocial(c.razaoSocial ?? "")
    setEditCpfCnpj(c.cpfCnpj ?? "")
    setEditOpen(true)
  }

  function handleSalvarCliente() {
    if (!editingCliente) return
    if (!editNomeFantasia.trim()) {
      toast.error("O Nome Fantasia é obrigatório.")
      return
    }
    if (editCpfCnpj.trim() && !validateCpfCnpj(editCpfCnpj)) {
      toast.error("CPF ou CNPJ inválido.")
      return
    }
    startEditTransition(async () => {
      try {
        await atualizarCliente(editingCliente.id, {
          nomeFantasia: editNomeFantasia,
          razaoSocial: editRazaoSocial || null,
          cpfCnpj: editCpfCnpj || null,
        })
        setEditOpen(false)
        router.refresh()
        toast.success("Cliente atualizado com sucesso.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar cliente. Tente novamente.")
      }
    })
  }

  // ── Add cliente modal ──────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addNomeFantasia, setAddNomeFantasia] = useState("")
  const [addRazaoSocial, setAddRazaoSocial] = useState("")
  const [addCpfCnpj, setAddCpfCnpj] = useState("")
  const [isAddPending, startAddTransition] = useTransition()

  function resetAddForm() {
    setAddNomeFantasia("")
    setAddRazaoSocial("")
    setAddCpfCnpj("")
  }

  function handleAdicionarCliente() {
    if (!addNomeFantasia.trim()) {
      toast.error("O Nome Fantasia é obrigatório.")
      return
    }
    if (addCpfCnpj.trim() && !validateCpfCnpj(addCpfCnpj)) {
      toast.error("CPF ou CNPJ inválido.")
      return
    }
    startAddTransition(async () => {
      try {
        await criarCliente({
          nomeFantasia: addNomeFantasia,
          razaoSocial: addRazaoSocial || null,
          cpfCnpj: addCpfCnpj || null,
        })
        setAddOpen(false)
        resetAddForm()
        router.refresh()
        toast.success("Cliente criado com sucesso.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar cliente. Tente novamente.")
      }
    })
  }

  const filtered = useMemo(() => {
    const result = localClientes.filter((c) => {
      const matchSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
        (c.razaoSocial ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.cpfCnpj ?? "").toLowerCase().includes(search.toLowerCase())
      const matchAtivo = apenasInativos ? !c.active : c.active
      return matchSearch && matchAtivo
    })
    return [...result].sort((a, b) => {
      const diff = numericId(a.id) - numericId(b.id)
      return sortOrder === "desc" ? -diff : diff
    })
  }, [search, apenasInativos, localClientes, sortOrder])

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
  const hasActiveClientes = localClientes.some((c) => c.active)
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
    const ids = [...inativarIds]
    const count = ids.length
    setInativarOpen(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setInativarIds([])
    setIsInativando(true)
    startTransition(async () => {
      try {
        await inativarClientes(ids)
        const idSet = new Set(ids)
        setLocalClientes((prev) => prev.map((c) => idSet.has(c.id) ? { ...c, active: false } : c))
        setIsInativando(false)
        router.refresh()
        toast.success(
          count === 1 ? "Cliente inativado com sucesso." : `${count} clientes inativados com sucesso.`
        )
      } catch {
        setIsInativando(false)
        router.refresh()
        toast.error("Erro ao inativar. Tente novamente.")
      }
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
      <LoadingOverlay visible={isInativando} label="Inativando clientes..." />
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
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Adicionar Cliente
            </Button>
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
              <table className="w-full min-w-190 table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-20" />
                  <col />
                  <col className="w-44" />
                  <col className="w-36" />
                  <col className="w-40" />
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
                      "sticky z-20 bg-neutral-grey-50 px-4 py-3 text-left text-xs font-semibold",
                      showBulkActions ? "left-10" : "left-0"
                    )}>
                      <button
                        type="button"
                        onClick={() => setSortOrder((prev) => prev === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-1 text-text-secondary transition-colors hover:text-text-primary"
                      >
                        Código
                        {sortOrder === "desc" ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Nome Fantasia</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Razão Social</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">CPF / CNPJ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Sistemas</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => {
                    const sistemas = sistemasByCliente.get(c.nomeFantasia) ?? []
                    return (
                      <tr
                        key={c.id}
                        className="group border-b border-border-default last:border-0"
                      >
                        {showBulkActions && (
                          <td className="sticky left-0 z-10 bg-surface-card px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                            <Checkbox
                              checked={selectedIds.has(c.id)}
                              onChange={() => toggleRow(c.id)}
                            />
                          </td>
                        )}
                        <td className={cn(
                          "sticky z-10 bg-surface-card px-4 py-3 font-medium whitespace-nowrap transition-colors group-hover:bg-neutral-grey-50",
                          showBulkActions ? "left-10" : "left-0"
                        )}>
                          {c.active ? (
                            <button type="button" onClick={() => openEditarCliente(c)} className="text-brand-primary hover:underline">{c.id}</button>
                          ) : (
                            <span>{c.id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary truncate transition-colors group-hover:bg-neutral-grey-50" title={c.nomeFantasia}>{c.nomeFantasia}</td>
                        <td className="px-4 py-3 text-text-secondary truncate transition-colors group-hover:bg-neutral-grey-50" title={c.razaoSocial ?? undefined}>
                          {c.razaoSocial ?? <span className="italic text-text-secondary/60">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-secondary truncate transition-colors group-hover:bg-neutral-grey-50" title={c.cpfCnpj ?? undefined}>
                          {c.cpfCnpj ?? <span className="italic text-text-secondary/60">—</span>}
                        </td>
                        <td className="px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                          {sistemas.length === 0 ? (
                            <span className="italic text-text-secondary/60 text-sm">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {sistemas.map((s) => (
                                <StatusBadge key={s} label={s} colorClass="border-brand-primary/30 bg-brand-primary/10 text-brand-primary" />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 transition-colors group-hover:bg-neutral-grey-50">
                          {showBulkActions && c.active ? (
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
                                <DropdownMenuItem onClick={() => openEditarCliente(c)}>
                                  Editar
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

      {/* ── Editar cliente modal ── */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Nome Fantasia <span className="text-destructive">*</span>
              </label>
              <Input
                value={editNomeFantasia}
                onChange={(e) => setEditNomeFantasia(e.target.value)}
                placeholder="Nome Fantasia"
                disabled={isEditPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Razão Social</label>
              <Input
                value={editRazaoSocial}
                onChange={(e) => setEditRazaoSocial(e.target.value)}
                placeholder="Razão Social"
                disabled={isEditPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">CPF / CNPJ</label>
              <Input
                value={editCpfCnpj}
                onChange={(e) => setEditCpfCnpj(formatCpfCnpj(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                disabled={isEditPending}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isEditPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleSalvarCliente} disabled={isEditPending}>
              <Check className="size-4" />
              {isEditPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adicionar cliente modal ── */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Nome Fantasia <span className="text-destructive">*</span>
              </label>
              <Input
                value={addNomeFantasia}
                onChange={(e) => setAddNomeFantasia(e.target.value)}
                placeholder="Nome Fantasia"
                disabled={isAddPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Razão Social</label>
              <Input
                value={addRazaoSocial}
                onChange={(e) => setAddRazaoSocial(e.target.value)}
                placeholder="Razão Social"
                disabled={isAddPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">CPF / CNPJ</label>
              <Input
                value={addCpfCnpj}
                onChange={(e) => setAddCpfCnpj(formatCpfCnpj(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                disabled={isAddPending}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isAddPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleAdicionarCliente} disabled={isAddPending}>
              <Check className="size-4" />
              {isAddPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
