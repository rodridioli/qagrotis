"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  getDominioConfiguracao,
  saveDominioConfiguracao,
  type DominioProduto,
  type DominioModulo,
} from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

type EditingKey = `produto-${string}` | `modulo-${string}-${string}`

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function DominioConfiguracaoSheet({ open, onOpenChange }: Props) {
  const [produtos, setProdutos] = React.useState<DominioProduto[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  // Inline-editing state
  const [editingKey, setEditingKey] = React.useState<EditingKey | null>(null)
  const [editingValue, setEditingValue] = React.useState("")

  // Expanded products
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())

  // Adding new items
  const [addingProdutoValue, setAddingProdutoValue] = React.useState("")
  const [showAddProduto, setShowAddProduto] = React.useState(false)
  const [addingModuloForProduto, setAddingModuloForProduto] = React.useState<string | null>(null)
  const [addingModuloValue, setAddingModuloValue] = React.useState("")

  const addProdutoRef = React.useRef<HTMLInputElement>(null)
  const addModuloRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    getDominioConfiguracao()
      .then((data) => {
        setProdutos(data)
        setExpandedIds(new Set(data.map((p) => p.id)))
        setDirty(false)
      })
      .catch(() => toast.error("Não foi possível carregar a configuração."))
      .finally(() => setLoading(false))
  }, [open])

  React.useEffect(() => {
    if (showAddProduto) addProdutoRef.current?.focus()
  }, [showAddProduto])

  React.useEffect(() => {
    if (addingModuloForProduto) addModuloRef.current?.focus()
  }, [addingModuloForProduto])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEditProduto(produto: DominioProduto) {
    setEditingKey(`produto-${produto.id}`)
    setEditingValue(produto.nome)
  }

  function startEditModulo(produtoId: string, modulo: DominioModulo) {
    setEditingKey(`modulo-${produtoId}-${modulo.id}`)
    setEditingValue(modulo.nome)
  }

  function commitEdit() {
    if (!editingKey) return
    const val = editingValue.trim()
    if (!val) {
      setEditingKey(null)
      return
    }
    if (editingKey.startsWith("produto-")) {
      const produtoId = editingKey.replace("produto-", "")
      setProdutos((prev) =>
        prev.map((p) => (p.id === produtoId ? { ...p, nome: val } : p)),
      )
    } else if (editingKey.startsWith("modulo-")) {
      // IDs contain hyphens, so split("-") is unreliable.
      // Instead, find the produto whose id is a prefix of the key after "modulo-".
      const rest = editingKey.slice("modulo-".length)
      setProdutos((prev) => {
        const produto = prev.find((p) => rest.startsWith(p.id + "-"))
        if (!produto) return prev
        const moduloId = rest.slice(produto.id.length + 1)
        return prev.map((p) =>
          p.id === produto.id
            ? { ...p, modulos: p.modulos.map((m) => (m.id === moduloId ? { ...m, nome: val } : m)) }
            : p,
        )
      })
    }
    setEditingKey(null)
    setDirty(true)
  }

  function removeProduto(id: string) {
    setProdutos((prev) => prev.filter((p) => p.id !== id))
    setDirty(true)
  }

  function removeModulo(produtoId: string, moduloId: string) {
    setProdutos((prev) =>
      prev.map((p) =>
        p.id === produtoId ? { ...p, modulos: p.modulos.filter((m) => m.id !== moduloId) } : p,
      ),
    )
    setDirty(true)
  }

  function commitAddProduto() {
    const val = addingProdutoValue.trim()
    if (!val) {
      setShowAddProduto(false)
      return
    }
    const newProduto: DominioProduto = { id: uid(), nome: val, modulos: [] }
    setProdutos((prev) => [...prev, newProduto])
    setExpandedIds((prev) => new Set([...prev, newProduto.id]))
    setAddingProdutoValue("")
    setShowAddProduto(false)
    setDirty(true)
  }

  function commitAddModulo() {
    if (!addingModuloForProduto) return
    const val = addingModuloValue.trim()
    if (!val) {
      setAddingModuloForProduto(null)
      return
    }
    setProdutos((prev) =>
      prev.map((p) =>
        p.id === addingModuloForProduto
          ? { ...p, modulos: [...p.modulos, { id: uid(), nome: val }] }
          : p,
      ),
    )
    setAddingModuloValue("")
    setAddingModuloForProduto(null)
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    const res = await saveDominioConfiguracao(produtos)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Configuração salva.")
    setDirty(false)
    onOpenChange(false)
  }

  function handleClose() {
    if (dirty) {
      if (!confirm("Há alterações não salvas. Deseja sair mesmo assim?")) return
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden sm:max-w-lg"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border-default pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SheetTitle>Configurar Teste de Domínio</SheetTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-text-secondary">Carregando…</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {produtos.length === 0 && !showAddProduto ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  Nenhum produto configurado. Adicione um produto para começar.
                </p>
              ) : null}

              {produtos.map((produto) => {
                const isExpanded = expandedIds.has(produto.id)
                const isEditingThisProduto = editingKey === `produto-${produto.id}`

                return (
                  <div
                    key={produto.id}
                    className="rounded-lg border border-border-default bg-surface-card"
                  >
                    {/* Product header */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleExpand(produto.id)}
                        className="shrink-0 text-text-secondary hover:text-text-primary"
                        aria-label={isExpanded ? "Recolher" : "Expandir"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>

                      {isEditingThisProduto ? (
                        <Input
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit()
                            if (e.key === "Escape") setEditingKey(null)
                          }}
                          className="h-7 flex-1 text-sm"
                        />
                      ) : (
                        <span className="flex-1 truncate text-sm font-medium text-text-primary">
                          {produto.nome}
                        </span>
                      )}

                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => isEditingThisProduto ? commitEdit() : startEditProduto(produto)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                          aria-label={isEditingThisProduto ? "Salvar produto" : "Editar produto"}
                        >
                          {isEditingThisProduto ? <Check className="size-4" /> : <Pencil className="size-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProduto(produto.id)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Excluir produto"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Modules */}
                    {isExpanded ? (
                      <div className="border-t border-border-default px-3 pb-2 pt-1">
                        {produto.modulos.length === 0 && addingModuloForProduto !== produto.id ? (
                          <p className="py-2 text-xs text-text-secondary">
                            Nenhum módulo. Adicione um módulo abaixo.
                          </p>
                        ) : null}

                        <div className="flex flex-col gap-1">
                          {produto.modulos.map((modulo) => {
                            const key = `modulo-${produto.id}-${modulo.id}`
                            const isEditingThisModulo = editingKey === key

                            return (
                              <div
                                key={modulo.id}
                                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-grey-50"
                              >
                                {isEditingThisModulo ? (
                                  <Input
                                    autoFocus
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitEdit()
                                      if (e.key === "Escape") setEditingKey(null)
                                    }}
                                    className="h-6 flex-1 text-xs"
                                  />
                                ) : (
                                  <span className="flex-1 truncate text-sm text-text-primary">
                                    {modulo.nome}
                                  </span>
                                )}
                                <div className="flex shrink-0 items-center">
                                  <button
                                    type="button"
                                    onClick={() => isEditingThisModulo ? commitEdit() : startEditModulo(produto.id, modulo)}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                                    aria-label={isEditingThisModulo ? "Salvar módulo" : "Editar módulo"}
                                  >
                                    {isEditingThisModulo ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeModulo(produto.id, modulo.id)}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    aria-label="Excluir módulo"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}

                          {addingModuloForProduto === produto.id ? (
                            <div className="flex items-center gap-2 px-2 py-1">
                              <Input
                                ref={addModuloRef}
                                value={addingModuloValue}
                                onChange={(e) => setAddingModuloValue(e.target.value)}
                                onBlur={commitAddModulo}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitAddModulo()
                                  if (e.key === "Escape") {
                                    setAddingModuloForProduto(null)
                                    setAddingModuloValue("")
                                  }
                                }}
                                placeholder="Nome do módulo"
                                className="h-7 flex-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={commitAddModulo}
                                className={cn(
                                  "rounded p-1 text-brand-primary hover:bg-brand-primary/10",
                                )}
                                aria-label="Confirmar módulo"
                              >
                                <Plus className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingModuloForProduto(null)
                                  setAddingModuloValue("")
                                }}
                                className="rounded p-1 text-text-secondary hover:bg-neutral-grey-100"
                                aria-label="Cancelar"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {addingModuloForProduto !== produto.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingModuloForProduto(produto.id)
                              setAddingModuloValue("")
                            }}
                            className="mt-1 flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-text-secondary hover:bg-neutral-grey-50 hover:text-text-primary"
                          >
                            <Plus className="size-3.5" />
                            Adicionar Módulo
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {/* Add product inline */}
              {showAddProduto ? (
                <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2.5">
                  <Input
                    ref={addProdutoRef}
                    value={addingProdutoValue}
                    onChange={(e) => setAddingProdutoValue(e.target.value)}
                    onBlur={commitAddProduto}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitAddProduto()
                      if (e.key === "Escape") {
                        setShowAddProduto(false)
                        setAddingProdutoValue("")
                      }
                    }}
                    placeholder="Nome do produto"
                    className="flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={commitAddProduto}
                    className="rounded p-1 text-brand-primary hover:bg-brand-primary/10"
                    aria-label="Confirmar produto"
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddProduto(false); setAddingProdutoValue("") }}
                    className="rounded p-1 text-text-secondary hover:bg-neutral-grey-100"
                    aria-label="Cancelar"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddProduto(true)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border-default px-3 py-3 text-sm text-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                >
                  <Plus className="size-4" />
                  Adicionar Produto
                </button>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border-default pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={saving}
            className="gap-1.5"
          >
            <X className="size-4 shrink-0" aria-hidden />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              <>
                <Check className="size-4 shrink-0" aria-hidden />
                Salvar
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
