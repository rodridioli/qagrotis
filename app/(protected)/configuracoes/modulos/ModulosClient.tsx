"use client"

import React, { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, MoreVertical, X, Filter, Power, Check } from "lucide-react"
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
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { inativarModulos, criarModulo, atualizarModulo, type ModuloRecord } from "@/lib/actions/modulos"
import { type SistemaRecord } from "@/lib/actions/sistemas"
import { type CenarioRecord } from "@/lib/actions/cenarios"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

interface Props {
  initialModulos: ModuloRecord[]
  initialCenarios: CenarioRecord[]
  initialSistemas: SistemaRecord[]
  isAdmin: boolean
}

export default function ModulosClient({ initialModulos, initialCenarios, initialSistemas, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isInativando, setIsInativando] = useState(false)

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [apenasInativos, setApenasInativos] = useState(false)
  const [pendingInativos, setPendingInativos] = useState(false)

  // ── Módulo modal (criar / editar) ──────────────────────────────────────────
  const [moduloModalOpen, setModuloModalOpen] = useState(false)
  const [moduloEditando, setModuloEditando] = useState<ModuloRecord | null>(null)
  const [moduloModalNome, setModuloModalNome] = useState("")
  const [moduloModalSistemaNome, setModuloModalSistemaNome] = useState("")
  const [moduloModalDescricao, setModuloModalDescricao] = useState("")
  const [isModuloModalPending, startModuloModalTransition] = useTransition()

  const sistemasAtivos = useMemo(() => initialSistemas.filter((s) => s.active), [initialSistemas])

  function openAdicionarModulo() {
    setModuloEditando(null)
    setModuloModalNome("")
    setModuloModalSistemaNome("")
    setModuloModalDescricao("")
    setModuloModalOpen(true)
  }

  function openEditarModulo(m: ModuloRecord) {
    setModuloEditando(m)
    setModuloModalNome(m.name)
    setModuloModalSistemaNome(m.sistemaName)
    setModuloModalDescricao(m.description ?? "")
    setModuloModalOpen(true)
  }

  function handleSalvarModulo() {
    if (!moduloModalNome.trim()) { toast.error("O nome do módulo é obrigatório."); return }
    if (!moduloModalSistemaNome) { toast.error("Selecione um sistema."); return }
    const sistema = sistemasAtivos.find((s) => s.name === moduloModalSistemaNome)
    startModuloModalTransition(async () => {
      try {
        if (moduloEditando) {
          await atualizarModulo(moduloEditando.id, {
            name: moduloModalNome,
            description: moduloModalDescricao || null,
            sistemaId: sistema?.id ?? moduloEditando.sistemaId,
            sistemaName: moduloModalSistemaNome,
          })
          toast.success("Módulo atualizado com sucesso.")
        } else {
          if (!sistema) { toast.error("Sistema não encontrado."); return }
          await criarModulo({
            name: moduloModalNome,
            description: moduloModalDescricao || null,
            sistemaId: sistema.id,
            sistemaName: sistema.name,
          })
          toast.success("Módulo criado com sucesso.")
        }
        setModuloModalOpen(false)
        setModuloEditando(null)
        setModuloModalNome("")
        setModuloModalSistemaNome("")
        setModuloModalDescricao("")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar. Tente novamente.")
      }
    })
  }
  // ──────────────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const result = initialModulos.filter((m) => {
      const matchSearch =
        !search ||
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.sistemaName.toLowerCase().includes(search.toLowerCase()) ||
        (m.description ?? "").toLowerCase().includes(search.toLowerCase())
      const matchAtivo = apenasInativos ? !m.active : m.active
      return matchSearch && matchAtivo
    })
    return [...result].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [search, apenasInativos, initialModulos])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = apenasInativos ? 1 : 0
  const hasActiveModulos = initialModulos.some((m) => m.active)
  const showBulkActions = isAdmin && !apenasInativos && hasActiveModulos
  const selectableIds = pageItems.map((m) => m.id)

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
        await inativarModulos(ids)
        router.refresh()
        toast.success(
          count === 1 ? "Módulo inativado com sucesso." : `${count} módulos inativados com sucesso.`
        )
      } catch {
        router.refresh()
        toast.error("Erro ao inativar. Tente novamente.")
      } finally {
        setIsInativando(false)
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
      ? `O módulo ${inativarIds[0]} será inativado. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} módulos serão inativados. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      <LoadingOverlay visible={isInativando} label="Inativando módulos..." />
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
          <span className="font-medium text-text-primary">Módulos</span>
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
            <Button onClick={openAdicionarModulo}>
              <Plus className="size-4" />
              Adicionar Módulo
            </Button>
          </div>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar módulo..."
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingInativos(apenasInativos); setFilterOpen(true) }}
          totalLabel="Total de módulos"
          totalCount={filtered.length}
          baseCount={initialModulos.length}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-20" />
                  <col className="w-48" />
                  <col className="w-44" />
                  <col />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Sistema</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Descrição</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Cenários</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((m) => (
                    <tr
                      key={m.id}
                      className="group border-b border-border-default last:border-0"
                    >
                      {showBulkActions && (
                        <td className="sticky left-0 z-10 bg-surface-card px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                          <Checkbox
                            checked={selectedIds.has(m.id)}
                            onChange={() => toggleRow(m.id)}
                          />
                        </td>
                      )}
                      <td className={cn(
                        "sticky z-10 bg-surface-card px-4 py-3 font-medium whitespace-nowrap transition-colors group-hover:bg-neutral-grey-50",
                        showBulkActions ? "left-10" : "left-0"
                      )}>
                        {m.active && isAdmin ? (
                          <button type="button" onClick={() => openEditarModulo(m)} className="text-brand-primary hover:underline">{m.id}</button>
                        ) : (
                          <span>{m.id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary truncate transition-colors group-hover:bg-neutral-grey-50" title={m.name}>{m.name}</td>
                      <td className="px-4 py-3 text-text-secondary truncate transition-colors group-hover:bg-neutral-grey-50" title={m.sistemaName}>{m.sistemaName}</td>
                      <td className="px-4 py-3 text-text-secondary truncate transition-colors group-hover:bg-neutral-grey-50" title={m.description ?? undefined}>
                        {m.description ?? <span className="italic text-text-secondary/60">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-text-secondary text-sm transition-colors group-hover:bg-neutral-grey-50">
                        {initialCenarios.filter((c) => c.module === m.name && c.active).length || <span className="italic text-text-secondary/60">0</span>}
                      </td>
                      <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 transition-colors group-hover:bg-neutral-grey-50">
                        {showBulkActions && m.active ? (
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
                              <DropdownMenuItem onClick={() => openEditarModulo(m)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleInativarSingle(m.id)}
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

      {/* ── Modal criar / editar módulo ── */}
      <Dialog open={moduloModalOpen} onOpenChange={(open) => { if (!open) { setModuloModalOpen(false); setModuloEditando(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{moduloEditando ? `Editar — ${moduloEditando.id}` : "Adicionar Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Nome <span className="text-destructive">*</span>
              </label>
              <Input
                value={moduloModalNome}
                onChange={(e) => setModuloModalNome(e.target.value)}
                placeholder="Nome do módulo"
                disabled={isModuloModalPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Sistema <span className="text-destructive">*</span>
              </label>
              <Select
                value={moduloModalSistemaNome}
                onValueChange={(v) => setModuloModalSistemaNome(v ?? "")}
                disabled={sistemasAtivos.length === 0 || isModuloModalPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sistemasAtivos.length === 0 ? "Nenhum sistema cadastrado" : "Selecionar sistema"} />
                </SelectTrigger>
                <SelectPopup>
                  {sistemasAtivos.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Descrição</label>
              <textarea
                rows={4}
                value={moduloModalDescricao}
                onChange={(e) => setModuloModalDescricao(e.target.value)}
                placeholder="Descreva o módulo..."
                disabled={isModuloModalPending}
                className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-50 disabled:pointer-events-none"
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isModuloModalPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleSalvarModulo} disabled={isModuloModalPending}>
              <Check className="size-4" />
              {isModuloModalPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
