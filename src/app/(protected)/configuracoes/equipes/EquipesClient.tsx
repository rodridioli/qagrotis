"use client"

import React, { useState, useTransition, useMemo } from "react"
import { toast } from "sonner"
import { MoreVertical, UserPlus, Trash2 } from "lucide-react"
import { PageBreadcrumb } from "@/components/shared/PageBreadcrumb"
import { EmptyState } from "@/components/shared/EmptyState"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { TablePagination } from "@/components/shared/TablePagination"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { AccessProfileBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  getMembrosDoLider,
  listMembrosDisponiveis,
  addMembro,
  removeMembro,
  listLideres,
  type LiderRow,
  type MembroVinculado,
} from "@/features/equipe/actions/equipes"

const ITEMS_PER_PAGE = 20

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

interface Props {
  initialLideres: LiderRow[]
}

export default function EquipesClient({ initialLideres }: Props) {
  const [lideres, setLideres] = useState<LiderRow[]>(initialLideres)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  // Sheet state
  const [selectedLider, setSelectedLider] = useState<LiderRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [membros, setMembros] = useState<MembroVinculado[]>([])
  const [disponiveis, setDisponiveis] = useState<{ id: string; name: string; email: string }[]>([])
  const [sheetLoading, setSheetLoading] = useState(false)
  const [selectedMembroId, setSelectedMembroId] = useState("")
  const [addPending, startAdd] = useTransition()
  const [removeTarget, setRemoveTarget] = useState<MembroVinculado | null>(null)
  const [removePending, startRemove] = useTransition()
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [duplicityError, setDuplicityError] = useState<string | null>(null)

  // ── Filtering / pagination ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lideres
    return lideres.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.accessProfile.toLowerCase().includes(q),
    )
  }, [lideres, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // ── Sheet open / reload ───────────────────────────────────────────────────

  async function openSheet(lider: LiderRow) {
    setSelectedLider(lider)
    setSheetOpen(true)
    setSheetLoading(true)
    setDuplicityError(null)
    setSelectedMembroId("")
    const [m, d] = await Promise.all([
      getMembrosDoLider(lider.id),
      listMembrosDisponiveis(lider.id),
    ])
    setMembros(m)
    setDisponiveis(d)
    setSheetLoading(false)
  }

  async function reloadSheet(liderId: string) {
    const [m, d, ls] = await Promise.all([
      getMembrosDoLider(liderId),
      listMembrosDisponiveis(liderId),
      listLideres(),
    ])
    setMembros(m)
    setDisponiveis(d)
    setLideres(ls)
    setSelectedLider((prev) => ls.find((l) => l.id === liderId) ?? prev)
  }

  // ── Add membro ────────────────────────────────────────────────────────────

  function handleAdd() {
    if (!selectedLider || !selectedMembroId) return
    setDuplicityError(null)
    startAdd(async () => {
      const res = await addMembro(selectedLider.id, selectedMembroId)
      if (res.error) {
        setDuplicityError(res.error)
        return
      }
      toast.success("Membro adicionado com sucesso.")
      setSelectedMembroId("")
      await reloadSheet(selectedLider.id)
    })
  }

  // ── Remove membro ─────────────────────────────────────────────────────────

  function handleRemoveConfirm() {
    if (!removeTarget || !selectedLider) return
    startRemove(async () => {
      const res = await removeMembro(removeTarget.id)
      setConfirmRemoveOpen(false)
      setRemoveTarget(null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Membro removido da equipe.")
      await reloadSheet(selectedLider.id)
    })
  }

  function openRemoveConfirm(membro: MembroVinculado) {
    setRemoveTarget(membro)
    setConfirmRemoveOpen(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[{ label: "Configurações", href: "/configuracoes" }, { label: "Equipes" }]}
        />
      </div>

      {/* ── Card: Toolbar + Tabela + Paginação ── */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar por nome, e-mail ou perfil..."
          baseCount={lideres.length}
          totalLabel="Líderes"
          totalCount={filtered.length}
        />

        {pageItems.length === 0 ? (
          <EmptyState
            message={
              search
                ? "Nenhum administrador corresponde à busca."
                : "Crie usuários Administradores com perfil QA, UX ou TW para configurar equipes."
            }
          />
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="qagrotis-table-row-hover w-full min-w-[36rem] table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col className="hidden sm:table-column" style={{ width: "28%" }} />
                  <col style={{ width: "9rem" }} />
                  <col style={{ width: "7rem" }} />
                  <col style={{ width: "3.25rem" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary" scope="col">
                      Nome
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-text-secondary sm:table-cell" scope="col">
                      E-mail
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary" scope="col">
                      Perfil
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary" scope="col">
                      Membros
                    </th>
                    <th className="py-3 pl-2 pr-4" scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((lider) => (
                    <tr
                      key={lider.id}
                      className="border-b border-border-default last:border-0 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {lider.name}
                      </td>
                      <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                        {lider.email}
                      </td>
                      <td className="px-4 py-3">
                        <AccessProfileBadge perfil={lider.accessProfile} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lider.memberCount > 0 ? (
                          <span className="text-sm font-semibold text-brand-primary">
                            {lider.memberCount}
                          </span>
                        ) : (
                          <span className="text-sm text-text-secondary">0</span>
                        )}
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  aria-label={`Ações para ${lider.name}`}
                                  className="flex size-8 items-center justify-center rounded-custom text-text-secondary transition-colors hover:bg-neutral-grey-100"
                                />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[180px]">
                              <DropdownMenuItem
                                className="whitespace-nowrap"
                                onClick={() => openSheet(lider)}
                              >
                                Gerenciar equipe
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* ── Sheet de Gerenciamento ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
          {selectedLider && (
            <>
              <SheetHeader className="border-b border-border-default px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-semibold text-brand-primary">
                    {getInitials(selectedLider.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SheetTitle className="truncate text-base font-semibold text-text-primary">
                        Equipe de {selectedLider.name}
                      </SheetTitle>
                      <AccessProfileBadge perfil={selectedLider.accessProfile} />
                    </div>
                    <p className="truncate text-xs text-text-secondary">{selectedLider.email}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                {sheetLoading ? (
                  /* Skeleton — padrão de loading do projeto */
                  <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando equipe...">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 animate-pulse rounded-xl bg-neutral-grey-100"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* ── Membros vinculados ── */}
                    <section>
                      <h3 className="mb-3 text-sm font-semibold text-text-primary">
                        Membros{" "}
                        <span className="font-normal text-text-secondary">({membros.length})</span>
                      </h3>

                      {membros.length === 0 ? (
                        <p className="text-sm text-text-secondary">
                          Nenhum membro vinculado ainda.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border-default overflow-hidden rounded-xl border border-border-default">
                          {membros.map((m) => (
                            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-grey-100 text-xs font-semibold text-text-secondary">
                                {getInitials(m.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-text-primary">
                                  {m.name}
                                </p>
                                <p className="truncate text-xs text-text-secondary">{m.email}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Remover ${m.name} da equipe`}
                                onClick={() => openRemoveConfirm(m)}
                                disabled={removePending}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {/* ── Adicionar membro — oculto quando não há disponíveis ── */}
                    {disponiveis.length > 0 && (
                      <section>
                        <h3 className="mb-3 text-sm font-semibold text-text-primary">
                          Adicionar membro
                        </h3>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Select
                              value={selectedMembroId}
                              onValueChange={(v) => {
                                setSelectedMembroId(v ?? "")
                                setDuplicityError(null)
                              }}
                            >
                              <SelectTrigger aria-label="Selecionar membro para adicionar">
                                <span className={selectedMembroId ? "text-text-primary" : "text-text-secondary"}>
                                  {selectedMembroId
                                    ? (disponiveis.find((d) => d.id === selectedMembroId)?.name ?? selectedMembroId)
                                    : "Selecionar membro..."}
                                </span>
                              </SelectTrigger>
                              <SelectPopup>
                                {disponiveis.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                  </SelectItem>
                                ))}
                              </SelectPopup>
                            </Select>
                          </div>
                          <Button
                            onClick={handleAdd}
                            disabled={!selectedMembroId || addPending}
                          >
                            {addPending ? (
                              <span
                                className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                                aria-hidden
                              />
                            ) : (
                              <UserPlus className="size-4" />
                            )}
                            Adicionar
                          </Button>
                        </div>

                        {duplicityError && (
                          <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {duplicityError}
                          </p>
                        )}
                      </section>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Confirm remoção ── */}
      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={(v) => {
          setConfirmRemoveOpen(v)
          if (!v) setRemoveTarget(null)
        }}
        title="Remover membro"
        description={
          removeTarget && selectedLider
            ? `Remover ${removeTarget.name} da equipe de ${selectedLider.name}? Esta ação pode ser desfeita adicionando-o novamente.`
            : ""
        }
        confirmLabel="Remover"
        confirmIcon={<Trash2 className="size-4 shrink-0" aria-hidden />}
        buttonVariant="destructive"
        disabled={removePending}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  )
}
