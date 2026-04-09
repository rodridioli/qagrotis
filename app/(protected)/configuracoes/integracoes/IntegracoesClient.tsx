"use client"

import React, { useState, useMemo, useTransition, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Check, ChevronDown, ChevronUp, Eye, EyeOff, Filter, Loader2, MoreVertical, Plus, Power, ShieldCheck, X } from "lucide-react"
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
import { inativarIntegracoes, criarIntegracao, atualizarIntegracao, type IntegracaoRecord } from "@/lib/actions/integracoes"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 20

function numericId(id: string): number {
  const m = id.match(/\d+$/)
  return m ? parseInt(m[0], 10) : 0
}

type KeyStatus = "idle" | "validating" | "valid" | "invalid" | "uncertain"

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
  const [isInativando, setIsInativando] = useState(false)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterState>({ apenasInativos: false })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)

  // ── Integração modal (criar / editar) ─────────────────────────────────────
  const [integracaoModalOpen, setIntegracaoModalOpen] = useState(false)
  const [integracaoEditando, setIntegracaoEditando] = useState<IntegracaoRecord | null>(null)
  const [intProvider, setIntProvider] = useState<"google" | "openai" | "anthropic" | "groq" | "openrouter">("openrouter")
  const [intModel, setIntModel] = useState("google/gemini-2.0-flash-exp:free")
  const [intApiKey, setIntApiKey] = useState("")
  const [intShowKey, setIntShowKey] = useState(false)
  const [intKeyStatus, setIntKeyStatus] = useState<KeyStatus>("idle")
  const [isIntegracaoModalPending, startIntegracaoModalTransition] = useTransition()

  function openAdicionarIntegracao() {
    setIntegracaoEditando(null)
    setIntProvider("openrouter")
    setIntModel("google/gemini-2.0-flash-exp:free")
    setIntApiKey("")
    setIntShowKey(false)
    setIntKeyStatus("idle")
    setIntegracaoModalOpen(true)
  }

  function openEditarIntegracao(item: IntegracaoRecord) {
    setIntegracaoEditando(item)
    setIntProvider((item.provider ?? "openrouter") as any)
    setIntModel(item.model ?? "")
    setIntApiKey(item.apiKey ?? "")
    setIntShowKey(false)
    setIntKeyStatus("idle")
    setIntegracaoModalOpen(true)
  }

  const handleIntProviderChange = (p: string | null) => {
    if (!p) return
    const prov = p as any
    setIntProvider(prov)
    if (prov === "openrouter") setIntModel("google/gemini-2.0-flash-exp:free")
    else if (prov === "google") setIntModel("gemini-2.0-flash-exp")
    else if (prov === "groq") setIntModel("llama-3.1-70b-versatile")
    else if (prov === "openai") setIntModel("gpt-4o-mini")
    else if (prov === "anthropic") setIntModel("claude-opus-4-6")
    setIntKeyStatus("idle")
  }

  const handleIntValidateKey = useCallback(async () => {
    if (!intApiKey.trim()) { toast.error("Digite a API Key antes de verificar."); return }
    setIntKeyStatus("validating")
    try {
      const res = await fetch("/api/integracoes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: intApiKey.trim(), provider: intProvider }),
      })
      if (res.ok) setIntKeyStatus("valid")
      else if (res.status === 401) setIntKeyStatus("invalid")
      else setIntKeyStatus("uncertain")
    } catch {
      setIntKeyStatus("uncertain")
    }
  }, [intApiKey, intProvider])

  function handleSalvarIntegracao() {
    if (!intApiKey.trim()) { toast.error("A API Key é obrigatória."); return }
    if (intKeyStatus === "validating") { toast.error("Aguarde a validação da API Key."); return }
    startIntegracaoModalTransition(async () => {
      try {
        if (integracaoEditando) {
          await atualizarIntegracao(integracaoEditando.id, {
            provider: intProvider,
            model: intModel.trim(),
            apiKey: intApiKey.trim(),
          })
          toast.success("Integração atualizada com sucesso.")
        } else {
          await criarIntegracao({
            provider: intProvider,
            model: intModel.trim(),
            apiKey: intApiKey.trim(),
          })
          toast.success("Integração criada com sucesso.")
        }
        setIntegracaoModalOpen(false)
        setIntegracaoEditando(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.")
      }
    })
  }

  const intStatusIcon: Record<KeyStatus, React.ReactNode> = {
    idle:       null,
    validating: <Loader2 className="size-4 animate-spin text-text-secondary" />,
    valid:      <Check className="size-4 text-green-600" />,
    invalid:    <AlertCircle className="size-4 text-destructive" />,
    uncertain:  <AlertCircle className="size-4 text-amber-500" />,
  }
  // ──────────────────────────────────────────────────────────────────────────

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
    return [...result].sort((a, b) => {
      const diff = numericId(a.id) - numericId(b.id)
      return sortOrder === "desc" ? -diff : diff
    })
  }, [search, filters, initialIntegracoes, sortOrder])

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
        await inativarIntegracoes(ids)
        router.refresh()
        toast.success(
          count === 1
            ? "Integração inativada com sucesso."
            : `${count} integrações inativadas com sucesso.`
        )
      } catch {
        router.refresh()
        toast.error("Erro ao inativar. Tente novamente.")
      } finally {
        setIsInativando(false)
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
      ? `A integração ${inativarIds[0]} será inativada. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} integrações serão inativadas. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      <LoadingOverlay visible={isInativando} label="Inativando integrações..." />
      {/* Header */}
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
            <Button onClick={openAdicionarIntegracao}>
              <Plus className="size-4" />
              Adicionar Integração
            </Button>
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
              <table className="w-full min-w-100 table-fixed text-sm">
                <colgroup>
                  {showBulkActions && <col className="w-10" />}
                  <col className="w-20" />
                  <col className="w-40" />
                  <col />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Provedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Modelo</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-b border-border-default last:border-0"
                    >
                      {showBulkActions && (
                        <td className="sticky left-0 z-10 bg-surface-card px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleRow(item.id)}
                          />
                        </td>
                      )}
                      <td className={cn(
                        "sticky z-10 bg-surface-card px-4 py-3 font-medium whitespace-nowrap transition-colors group-hover:bg-neutral-grey-50",
                        showBulkActions ? "left-10" : "left-0"
                      )}>
                        {item.active && isAdmin ? (
                          <button type="button" onClick={() => openEditarIntegracao(item)} className="text-brand-primary hover:underline">
                            {item.id}
                          </button>
                        ) : (
                          <span>{item.id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 truncate capitalize text-text-primary transition-colors group-hover:bg-neutral-grey-50" title={item.provider}>
                        {item.provider}
                      </td>
                      <td className="px-4 py-3 truncate text-text-secondary font-mono text-xs transition-colors group-hover:bg-neutral-grey-50" title={item.model}>
                        {item.model}
                      </td>
                      <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 transition-colors group-hover:bg-neutral-grey-50">
                        {showBulkActions && item.active ? (
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
                              <DropdownMenuItem onClick={() => openEditarIntegracao(item)}>
                                Editar
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

      {/* ── Modal criar / editar integração ── */}
      <Dialog open={integracaoModalOpen} onOpenChange={(open) => { if (!open) { setIntegracaoModalOpen(false); setIntegracaoEditando(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{integracaoEditando ? `Editar — ${integracaoEditando.id}` : "Adicionar Integração"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Provedor */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Provedor <span className="text-destructive">*</span>
                </label>
                <Select value={intProvider} onValueChange={handleIntProviderChange} disabled={isIntegracaoModalPending}>
                  <SelectTrigger>
                    <SelectValue>
                      <span className="capitalize">{intProvider}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="openrouter">OpenRouter (Gratuito)</SelectItem>
                    <SelectItem value="groq">Groq (Llama, Mixtral)</SelectItem>
                    <SelectItem value="google">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectPopup>
                </Select>
              </div>

              {/* Modelo */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Modelo <span className="text-destructive">*</span>
                </label>
                <Input
                  value={intModel}
                  onChange={(e) => setIntModel(e.target.value)}
                  placeholder="Ex.: gemini-2.0-flash, llama-3.1-70b..."
                  disabled={isIntegracaoModalPending}
                />
                {intProvider === "openrouter" && (
                  <p className="text-[10px] text-text-secondary">
                    Com visão: <span className="font-medium">google/gemini-2.0-flash-exp:free</span> · meta-llama/llama-3.2-11b-vision-instruct:free
                  </p>
                )}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                API Key <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={intShowKey ? "text" : "password"}
                    value={intApiKey}
                    onChange={(e) => { setIntApiKey(e.target.value); setIntKeyStatus("idle") }}
                    placeholder="Cole aqui a sua API Key..."
                    className="pr-16"
                    disabled={isIntegracaoModalPending}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                    {intStatusIcon[intKeyStatus]}
                    <button
                      type="button"
                      onClick={() => setIntShowKey((v) => !v)}
                      className="text-text-secondary hover:text-text-primary transition-colors"
                      aria-label={intShowKey ? "Ocultar chave" : "Exibir chave"}
                    >
                      {intShowKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleIntValidateKey}
                  disabled={intKeyStatus === "validating" || !intApiKey.trim() || isIntegracaoModalPending}
                  title="Verificar conexão com a API"
                  aria-label="Verificar conexão com a API"
                  className="flex size-10 shrink-0 items-center justify-center rounded-custom border border-border-default bg-surface-input text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  <ShieldCheck className="size-4" />
                </button>
              </div>
              <p className={`text-xs ${
                intKeyStatus === "valid"     ? "text-green-600" :
                intKeyStatus === "invalid"   ? "text-destructive" :
                intKeyStatus === "uncertain" ? "text-amber-600" :
                "text-text-secondary"
              }`}>
                {intKeyStatus === "idle"       && "Clique no ícone de escudo para verificar a conexão."}
                {intKeyStatus === "validating" && "Verificando conexão com a API…"}
                {intKeyStatus === "valid"      && "Chave válida — conexão com a API confirmada."}
                {intKeyStatus === "invalid"    && "Chave inválida — verifique se copiou corretamente."}
                {intKeyStatus === "uncertain"  && "Não foi possível confirmar agora. Você pode salvar assim mesmo."}
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isIntegracaoModalPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleSalvarIntegracao} disabled={isIntegracaoModalPending || intKeyStatus === "validating"}>
              <Check className="size-4" />
              {isIntegracaoModalPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
