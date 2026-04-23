"use client"

import React, { useState, useMemo, useEffect, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, MoreVertical, Pencil, RotateCcw, X, Filter, Power, AlertCircle, RefreshCw } from "lucide-react"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"
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
import { UserTipoBadge } from "@/components/qagrotis/StatusBadge"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { inativarQaUsers, ativarQaUser, getQaUsers, type QaUserRecord } from "@/lib/actions/usuarios"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 20

function numericId(id: string): number {
  const m = id.match(/\d+$/)
  return m ? parseInt(m[0], 10) : 0
}


function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

interface FilterState {
  tipo: string
  apenasInativos: boolean
}

interface Props {
  initialUsers: QaUserRecord[]
  currentUserId: string | null
  isAdmin: boolean
  /** true quando getQaUsers() falhou no servidor — lista veio vazia por erro, não porque não há cadastros */
  usersFetchFailed?: boolean
  usersFetchErrorMessage?: string | null
}

export default function UsuariosClient({
  initialUsers,
  currentUserId,
  isAdmin,
  usersFetchFailed = false,
  usersFetchErrorMessage = null,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [users, setUsers] = useState<QaUserRecord[]>(initialUsers)

  // Keep local users in sync when initialUsers changes (e.g. after router.refresh())
  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  // If the currently logged-in user is not yet in the list (e.g. just registered via Google OAuth),
  // fetch fresh users directly via server action — avoids router.refresh() which would
  // reload the entire layout (including heavy DB queries) and disable the menu for ~20s.
  useEffect(() => {
    if (!currentUserId) return
    if (initialUsers.some((u) => u.id === currentUserId)) return
    getQaUsers().then((fresh) => setUsers(fresh)).catch(() => {})
  }, [currentUserId, initialUsers])
  const [isInativando, setIsInativando] = useState(false)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [ativarId, setAtivarId] = useState<string | null>(null)
  const [ativarOpen, setAtivarOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ tipo: "", apenasInativos: false })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)
  const [reloadBusy, setReloadBusy] = useState(false)
  /** Após carregar com sucesso no cliente, some o aviso de falha do SSR */
  const [fetchRecovered, setFetchRecovered] = useState(false)

  const filtered = useMemo(() => {
    const result = users.filter((u) => {
      const matchSearch =
        !search ||
        u.id.toLowerCase().includes(search.toLowerCase()) ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      const matchTipo = !filters.tipo || u.type === filters.tipo
      // Padrão: só ativos. Com "Exibir somente inativos": apenas inativos.
      const matchAtivo = filters.apenasInativos ? !u.active : u.active
      return matchSearch && matchTipo && matchAtivo
    })
    return [...result].sort((a, b) => {
      const diff = numericId(a.id) - numericId(b.id)
      return sortOrder === "desc" ? -diff : diff
    })
  }, [search, filters, users, sortOrder])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = [filters.tipo, filters.apenasInativos ? "1" : ""].filter(Boolean).length
  // Checkboxes and bulk inactivation only apply when there are other active users to act on
  const hasOtherActiveUsers = users.some((u) => u.id !== currentUserId && u.active)
  const showBulkActions = isAdmin && !filters.apenasInativos && hasOtherActiveUsers

  // Protect the last active admin from being inactivated
  const activeAdminCount = useMemo(
    () => users.filter((u) => u.active && u.type === "Administrador").length,
    [users]
  )
  function isLastActiveAdmin(u: QaUserRecord) {
    return u.active && u.type === "Administrador" && activeAdminCount === 1
  }

  // Selectable = current page items excluding own account and the last active admin
  const selectableIds = pageItems
    .filter((u) => u.id !== currentUserId && !isLastActiveAdmin(u) && u.active)
    .map((u) => u.id)

  function toggleRow(id: string) {
    if (id === currentUserId) return
    const u = users.find((u) => u.id === id)
    if (u && isLastActiveAdmin(u)) return
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
    const u = users.find((u) => u.id === id)
    if (u && isLastActiveAdmin(u)) return
    setInativarIds([id])
    setInativarOpen(true)
  }

  async function handleAtivar() {
    if (!ativarId) return
    try {
      const result = await ativarQaUser(ativarId)
      if (result?.error) { toast.error(result.error); return }
      setUsers((prev) =>
        prev.map((u) => (u.id === ativarId ? { ...u, active: true } : u)),
      )
      toast.success("Cadastro ativado com sucesso.")
      router.refresh()
    } catch {
      toast.error("Erro ao ativar. Tente novamente.")
    } finally {
      setAtivarOpen(false)
      setAtivarId(null)
    }
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
        const result = await inativarQaUsers(ids)
        if (result.error) {
          toast.error(result.error)
          setIsInativando(false)
          return
        }
        // Optimistic update: mark users as inactive immediately so the UI
        // updates before router.refresh() completes — no visible delay.
        const idSet = new Set(ids)
        setUsers((prev) => prev.map((u) => idSet.has(u.id) ? { ...u, active: false } : u))
        setIsInativando(false)
        router.refresh()
        toast.success(
          count === 1
            ? "Usuário inativado com sucesso."
            : `${count} usuários inativados com sucesso.`
        )
      } catch {
        setIsInativando(false)
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

  async function handleReloadUsers() {
    setReloadBusy(true)
    try {
      const fresh = await getQaUsers()
      setUsers(fresh)
      setFetchRecovered(true)
      toast.success("Lista de usuários carregada.")
      router.refresh()
    } catch {
      toast.error("Não foi possível carregar a lista. Tente de novo em instantes.")
    } finally {
      setReloadBusy(false)
    }
  }

  const confirmDescription =
    inativarIds.length === 1
      ? `O usuário ${inativarIds[0]} será inativado. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} usuários serão inativados. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      <LoadingOverlay visible={isInativando} label="Inativando usuários..." />
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
          <span className="font-medium text-text-primary">Usuários</span>
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
            <Link href="/configuracoes/usuarios/novo">
              <Button>
                <Plus className="size-4" />
                Adicionar Usuário
              </Button>
            </Link>
          </div>
        )}
      </div>

      {usersFetchFailed && !fetchRecovered && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-text-primary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Não foi possível carregar a lista no servidor</p>
              <p className="text-text-secondary">
                Isso não apaga cadastros: em geral é falha temporária de banco ou rede. Os usuários continuam gravados no
                banco de dados. Use o botão para buscar de novo.
              </p>
              {usersFetchErrorMessage ? (
                <p className="font-mono text-xs text-text-secondary/80 break-all">{usersFetchErrorMessage}</p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-amber-600/50"
            disabled={reloadBusy}
            onClick={() => void handleReloadUsers()}
          >
            <RefreshCw className={cn("size-4", reloadBusy && "animate-spin")} />
            {reloadBusy ? "Carregando…" : "Tentar novamente"}
          </Button>
        </div>
      )}

      {/* ── Table card ── */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar usuário..."
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Total de usuários"
          totalCount={filtered.length}
          baseCount={users.length}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            {usersFetchFailed && !fetchRecovered && users.length === 0
              ? "Lista indisponível. Use o botão Tentar novamente acima ou verifique o banco de dados (Vercel / Postgres)."
              : "Nenhum registro encontrado."}
          </div>
        ) : (
          <>
            <div className="min-w-0 w-full overflow-x-auto sm:overflow-x-visible">
              <table className="w-full min-w-0 table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col style={{ width: "2.5rem" }} />}
                  <col style={{ width: "5.25rem" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "7rem" }} />
                  <col />
                  <col style={{ width: "3.25rem" }} />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">E-mail</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cargo</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((u) => {
                    const isSelf = u.id === currentUserId
                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          "group border-b border-border-default last:border-0",
                          !u.active && "bg-neutral-grey-50/90",
                        )}
                      >
                        {showBulkActions && (
                          <td className="sticky left-0 z-10 bg-surface-card px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                            <Checkbox
                              checked={selectedIds.has(u.id)}
                              onChange={() => toggleRow(u.id)}
                              disabled={isSelf || isLastActiveAdmin(u)}
                            />
                          </td>
                        )}
                        <td className={cn(
                          "sticky z-10 bg-surface-card px-4 py-3 font-medium whitespace-nowrap transition-colors group-hover:bg-neutral-grey-50",
                          showBulkActions ? "left-10" : "left-0"
                        )}>
                          {u.active && (isAdmin || isSelf) ? (
                            <Link href={`/configuracoes/usuarios/${u.id}/editar`} className="text-brand-primary hover:underline">{u.id}</Link>
                          ) : (
                            <span>{u.id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-0 transition-colors group-hover:bg-neutral-grey-50">
                          <div className="flex min-w-0 items-center gap-2">
                            {u.photoPath ? (
                              <Image
                                src={u.photoPath}
                                alt={u.name}
                                width={28}
                                height={28}
                                unoptimized
                                className="size-7 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-brand-primary">
                                {getInitials(u.name)}
                              </div>
                            )}
                            <span className="truncate font-medium text-text-primary" title={u.name}>{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary truncate transition-colors group-hover:bg-neutral-grey-50" title={u.email}>{u.email}</td>
                        <td className="px-4 py-3 transition-colors group-hover:bg-neutral-grey-50"><UserTipoBadge tipo={u.type} /></td>
                        <td
                          className="min-w-0 px-4 py-3 text-text-secondary transition-colors group-hover:bg-neutral-grey-50"
                          title={u.classificacao ?? undefined}
                        >
                          <span className="block truncate whitespace-nowrap">
                            {u.classificacao ?? "—"}
                          </span>
                        </td>
                        <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 transition-colors group-hover:bg-neutral-grey-50">
                          {filters.apenasInativos && !isSelf ? (
                            <button
                              type="button"
                              aria-label="Ativar"
                              onClick={() => { setAtivarId(u.id); setAtivarOpen(true) }}
                              className="flex size-8 items-center justify-center rounded-custom text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                            >
                              <RotateCcw className="size-4" />
                            </button>
                          ) : isSelf ? (
                            <Link
                              href={`/configuracoes/usuarios/${u.id}/editar`}
                              title="Editar meu cadastro"
                              aria-label="Editar meu cadastro"
                              className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                            >
                              <Pencil className="size-4" />
                            </Link>
                          ) : showBulkActions ? (
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
                                  <Link href={`/configuracoes/usuarios/${u.id}/editar`} className="w-full">
                                    Editar
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={isLastActiveAdmin(u)}
                                  onClick={() => handleInativarSingle(u.id)}
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
          <div className="space-y-6 py-2">
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
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Padrão">Padrão</SelectItem>
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
            <DialogClose render={<Button variant="ghost" onClick={() => { setPendingFilters({ tipo: "", apenasInativos: false }); setFilters({ tipo: "", apenasInativos: false }); setCurrentPage(1) }} />}>
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

      <ConfirmDialog
        open={ativarOpen}
        onOpenChange={setAtivarOpen}
        title="Deseja ativar?"
        description="Este cadastro voltará a aparecer na listagem de ativos."
        confirmLabel="Ativar"
        onConfirm={handleAtivar}
      />
    </div>
  )
}
