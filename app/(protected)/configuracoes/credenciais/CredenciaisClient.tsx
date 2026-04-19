"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, MoreVertical, Plus, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { toast } from "sonner"
import { criarCredencial, atualizarCredencial, inativarCredencial, type CredencialRecord } from "@/lib/actions/credenciais"

const ITEMS_PER_PAGE = 20

interface Props {
  initialCredenciais: CredencialRecord[]
}

export function CredenciaisClient({ initialCredenciais }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialCredenciais)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [nome, setNome] = useState("")
  const [urlAmbiente, setUrlAmbiente] = useState("")
  const [usuario, setUsuario] = useState("")
  const [senha, setSenha] = useState("")
  const [showSenha, setShowSenha] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<CredencialRecord | null>(null)
  const [editNome, setEditNome] = useState("")
  const [editUrlAmbiente, setEditUrlAmbiente] = useState("")
  const [editUsuario, setEditUsuario] = useState("")
  const [editSenha, setEditSenha] = useState("")
  const [showEditSenha, setShowEditSenha] = useState(false)
  const [isEditPending, startEditTransition] = useTransition()

  // Inativar
  const [inativarId, setInativarId] = useState<string | null>(null)
  const [inativarOpen, setInativarOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter((c) => c.nome.toLowerCase().includes(q))
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  function resetAddForm() {
    setNome("")
    setUrlAmbiente("")
    setUsuario("")
    setSenha("")
    setShowSenha(false)
  }

  function openEditar(c: CredencialRecord) {
    setEditItem(c)
    setEditNome(c.nome)
    setEditUrlAmbiente(c.urlAmbiente ?? "")
    setEditUsuario(c.usuario)
    setEditSenha("")
    setShowEditSenha(false)
    setEditOpen(true)
  }

  function handleSalvar() {
    if (!nome.trim()) { toast.error("Credencial é obrigatório."); return }
    if (!usuario.trim()) { toast.error("Usuário é obrigatório."); return }
    if (!senha) { toast.error("Senha é obrigatória."); return }
    startTransition(async () => {
      try {
        const created = await criarCredencial({
          nome: nome.trim(),
          urlAmbiente: urlAmbiente.trim() || null,
          usuario: usuario.trim(),
          senha,
        })
        setItems((prev) => [created, ...prev])
        toast.success("Credencial adicionada com sucesso.")
        setAddOpen(false)
        resetAddForm()
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar.")
      }
    })
  }

  function handleEditar() {
    if (!editItem) return
    if (!editNome.trim()) { toast.error("Credencial é obrigatório."); return }
    if (!editUsuario.trim()) { toast.error("Usuário é obrigatório."); return }
    startEditTransition(async () => {
      try {
        const updated = await atualizarCredencial(editItem.id, {
          nome: editNome.trim(),
          urlAmbiente: editUrlAmbiente.trim() || null,
          usuario: editUsuario.trim(),
          senha: editSenha || undefined,
        })
        setItems((prev) => prev.map((c) => c.id === updated.id ? updated : c))
        toast.success("Credencial atualizada com sucesso.")
        setEditOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar.")
      }
    })
  }

  async function handleInativar() {
    if (!inativarId) return
    try {
      await inativarCredencial(inativarId)
      setItems((prev) => prev.filter((c) => c.id !== inativarId))
      toast.success("Credencial inativada.")
      router.refresh()
    } catch {
      toast.error("Erro ao inativar.")
    } finally {
      setInativarOpen(false)
      setInativarId(null)
    }
  }

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
          <span className="font-medium text-text-primary">Credenciais</span>
        </div>

        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Adicionar Credencial
        </Button>
      </div>

      {/* ── Table card ── */}
      <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Buscar credencial..."
          totalLabel="Total de credenciais"
          totalCount={filtered.length}
          baseCount={items.length}
        />

        {filtered.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            {items.length === 0 ? (
              <div className="space-y-3">
                <p>Nenhuma credencial cadastrada.</p>
                <Button variant="outline" onClick={() => setAddOpen(true)} className="gap-2">
                  <Plus className="size-4" />
                  Adicionar Credencial
                </Button>
              </div>
            ) : (
              "Nenhum resultado para a busca."
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Credencial</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">URL do Ambiente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Usuário</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => (
                    <tr key={c.id} className="group border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditar(c)}
                          className="text-brand-primary hover:underline"
                        >
                          {c.id}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">{c.nome}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-text-secondary" title={c.urlAmbiente ?? undefined}>
                        {c.urlAmbiente ?? <span className="italic text-text-secondary/60">—</span>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{c.usuario}</td>
                      <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 transition-colors group-hover:bg-neutral-grey-50">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                aria-label="Mais ações"
                                className="flex size-8 items-center justify-center rounded-custom text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                              />
                            }
                          >
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditar(c)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => { setInativarId(c.id); setInativarOpen(true) }}
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
            {totalPages > 1 && (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modal adicionar ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Credencial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Credencial <span className="text-destructive">*</span>
              </label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Staging, Produção..."
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Ambiente</label>
              <Input
                value={urlAmbiente}
                onChange={(e) => setUrlAmbiente(e.target.value)}
                placeholder="https://app.example.com"
                type="url"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Usuário <span className="text-destructive">*</span>
              </label>
              <Input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="usuario@exemplo.com"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Senha <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-secondary transition-colors hover:text-text-primary"
                  aria-label={showSenha ? "Ocultar senha" : "Exibir senha"}
                >
                  {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleSalvar} disabled={isPending} className="gap-2">
              <Check className="size-4" />
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal editar ── */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Credencial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Credencial <span className="text-destructive">*</span>
              </label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Ex.: Staging, Produção..."
                disabled={isEditPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Ambiente</label>
              <Input
                value={editUrlAmbiente}
                onChange={(e) => setEditUrlAmbiente(e.target.value)}
                placeholder="https://app.example.com"
                type="url"
                disabled={isEditPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Usuário <span className="text-destructive">*</span>
              </label>
              <Input
                value={editUsuario}
                onChange={(e) => setEditUsuario(e.target.value)}
                placeholder="usuario@exemplo.com"
                disabled={isEditPending}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Nova Senha</label>
              <div className="relative">
                <Input
                  type={showEditSenha ? "text" : "password"}
                  value={editSenha}
                  onChange={(e) => setEditSenha(e.target.value)}
                  placeholder="Deixe em branco para manter a atual"
                  className="pr-10"
                  disabled={isEditPending}
                />
                <button
                  type="button"
                  onClick={() => setShowEditSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-secondary transition-colors hover:text-text-primary"
                  aria-label={showEditSenha ? "Ocultar senha" : "Exibir senha"}
                >
                  {showEditSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-text-secondary">Deixe em branco para manter a senha atual.</p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isEditPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleEditar} disabled={isEditPending} className="gap-2">
              <Check className="size-4" />
              {isEditPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={inativarOpen}
        onOpenChange={setInativarOpen}
        title="Deseja inativar?"
        description="Esta credencial será inativada e não poderá ser usada em novos cenários."
        confirmLabel="Inativar"
        onConfirm={handleInativar}
      />
    </div>
  )
}
