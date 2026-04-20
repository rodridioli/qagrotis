"use client"

import { useState, useEffect, useMemo, useTransition, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRightLeft, ChevronDown, ChevronUp, FileText, Filter, MoreVertical, Plus, Power, RotateCcw, Upload, X } from "lucide-react"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { CenarioTipoBadge } from "@/components/qagrotis/StatusBadge"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { criarCenario, atualizarCenario, inativarCenarios, ativarCenario, type CenarioRecord } from "@/lib/actions/cenarios"
import { parseMarkdownCenarios, buildImportItems, type ImportItem, COMPARE_FIELDS } from "@/lib/parse-cenarios"
import { cn } from "@/lib/utils"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { ClienteRecord } from "@/lib/actions/clientes"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 20

function numericId(id: string): number {
  const m = id.match(/\d+$/)
  return m ? parseInt(m[0], 10) : 0
}

interface FilterState {
  modulo: string
  cliente: string
  tipo: string
  apenasInativos: boolean
}

interface Props {
  initialCenarios: CenarioRecord[]
  allModulos: ModuloRecord[]
  initialClientes: ClienteRecord[]
}

export default function CenariosClient({ initialCenarios: initialCenariosParam, allModulos, initialClientes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isImporting, setIsImporting] = useState(false)
  const [initialCenarios, setInitialCenarios] = useState(initialCenariosParam)
  useEffect(() => { setInitialCenarios(initialCenariosParam) }, [initialCenariosParam])
  const [isInativando, setIsInativando] = useState(false)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const { sistemaSelecionado } = useSistemaSelecionado()
  const setupFileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [inativarOpen, setInativarOpen] = useState(false)
  const [inativarIds, setInativarIds] = useState<string[]>([])
  const [ativarId, setAtivarId] = useState<string | null>(null)
  const [ativarOpen, setAtivarOpen] = useState(false)
  // Setup modal
  const [importSetupOpen, setImportSetupOpen] = useState(false)
  const [importSetupModule, setImportSetupModule] = useState("")
  const [importSetupFile, setImportSetupFile] = useState<File | null>(null)
  // Preview modal
  const [importItems, setImportItems] = useState<ImportItem[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [compareItem, setCompareItem] = useState<ImportItem | null>(null)
  // Progress
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importProgressOpen, setImportProgressOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    modulo: "",
    cliente: "",
    tipo: "",
    apenasInativos: false,
  })
  const [pendingFilters, setPendingFilters] = useState<FilterState>(filters)

  const modulosDosistema = useMemo(
    () => allModulos.filter((m) => m.active && m.sistemaName === sistemaSelecionado).map((m) => m.name),
    [allModulos, sistemaSelecionado]
  )

  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [sistemaSelecionado])

  const clienteNames = initialClientes.map((c) => c.nomeFantasia)

  const filtered = useMemo(() => {
    const result = initialCenarios.filter((c) => {
      const matchSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.scenarioName.toLowerCase().includes(search.toLowerCase())
      const matchSistema = !sistemaSelecionado || c.system === sistemaSelecionado
      const matchModulo = !filters.modulo || c.module === filters.modulo
      const matchCliente = !filters.cliente || c.client === filters.cliente
      const matchTipo = !filters.tipo || c.tipo === filters.tipo
      const matchAtivo = filters.apenasInativos ? !c.active : c.active
      return matchSearch && matchSistema && matchModulo && matchCliente && matchTipo && matchAtivo
    })
    return [...result].sort((a, b) => {
      const diff = numericId(a.id) - numericId(b.id)
      return sortOrder === "desc" ? -diff : diff
    })
  }, [search, filters, sistemaSelecionado, initialCenarios, sortOrder])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const activeFilterCount = [
    filters.modulo,
    filters.cliente,
    filters.tipo,
    filters.apenasInativos ? "1" : "",
  ].filter(Boolean).length

  const hasActiveCenarios = initialCenarios.some((c) => c.active)
  const showBulkActions = !filters.apenasInativos && hasActiveCenarios
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

  async function handleAtivar() {
    if (!ativarId) return
    try {
      await ativarCenario(ativarId)
      setInitialCenarios((prev) => prev.filter((c) => c.id !== ativarId))
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
        await inativarCenarios(ids)
        const idSet = new Set(ids)
        setInitialCenarios((prev) => prev.map((c) => idSet.has(c.id) ? { ...c, active: false } : c))
        setIsInativando(false)
        router.refresh()
        toast.success(
          count === 1
            ? "Cenário inativado com sucesso."
            : `${count} cenários inativados com sucesso.`
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

  function clearFilters() {
    const empty = { modulo: "", cliente: "", tipo: "", apenasInativos: false }
    setPendingFilters(empty)
    setFilters(empty)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  const systemModuleNames = useMemo(
    () => allModulos.filter((m) => m.active && m.sistemaName === sistemaSelecionado).map((m) => m.name),
    [allModulos, sistemaSelecionado]
  )

  function handleSetupConfirm() {
    if (!importSetupFile || !importSetupModule) return
    if (importSetupFile.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo 2 MB."); return }
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (!text) { toast.error("Arquivo vazio."); return }
      const parsed = parseMarkdownCenarios(text)
      if (parsed.length === 0) { toast.error("Nenhum cenário encontrado no arquivo."); return }

      const items = buildImportItems(parsed, importSetupModule, initialCenarios)
      setImportItems(items)
      setImportSetupOpen(false)
      setImportModalOpen(true)
    }
    reader.readAsText(importSetupFile, "utf-8")
  }

  async function handleImportConfirm() {
    const toImport = importItems.filter((item) => item.include && !item.error)
    if (toImport.length === 0) { toast.warning("Nenhum cenário selecionado para importar."); return }

    setImportModalOpen(false)
    setImportProgress({ current: 0, total: toImport.length })
    setImportProgressOpen(true)
    setIsImporting(true)

    let success = 0
    try {
      for (let i = 0; i < toImport.length; i++) {
        const item = toImport[i]
        const payload = {
            scenarioName:      item.parsed.scenarioName,
            system:            sistemaSelecionado,
            module:            item.parsed.module,
            client:            item.parsed.client,
            risco:             item.parsed.risco,
            tipo:              item.parsed.tipo,
            descricao:         item.parsed.descricao         || item.parsed.bdd || "-",
            caminhoTela:       item.parsed.caminhoTela,
            regraDeNegocio:    item.parsed.regraDeNegocio    || "Não informado.",
            preCondicoes:      item.parsed.preCondicoes,
            bdd:               item.parsed.bdd,
            resultadoEsperado: item.parsed.resultadoEsperado || "-",
            urlAmbiente: "",
            objetivo: "",
            urlScript: "",
            usuarioTeste: "",
            senhaTeste: "",
            senhaFalsa: "",
            steps: [],
            deps: [],
          }
        try {
          if (item.replace && item.existing) {
            await atualizarCenario(item.existing.id, payload)
          } else {
            await criarCenario(payload)
          }
          success++
        } catch (err) {
          toast.error(`Erro ao importar "${item.parsed.scenarioName}": ${err instanceof Error ? err.message : "Erro desconhecido"}`)
        }
        setImportProgress({ current: i + 1, total: toImport.length })
      }
    } finally {
      setIsImporting(false)
      setImportProgressOpen(false)
    }

    if (success > 0) {
      router.refresh()
      toast.success(success === 1 ? "1 cenário importado com sucesso." : `${success} cenários importados com sucesso.`)
    }
  }

  const confirmDescription =
    inativarIds.length === 1
      ? `O cenário ${inativarIds[0]} será inativado. Esta ação não pode ser desfeita.`
      : `${inativarIds.length} cenários serão inativados. Esta ação não pode ser desfeita.`

  return (
    <div className="space-y-4">
      <LoadingOverlay visible={isInativando} label="Inativando cenários..." />
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-end gap-3">
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
        <Button
          variant="outline"
          disabled={isImporting || !sistemaSelecionado}
          onClick={() => {
            setImportSetupModule("")
            setImportSetupFile(null)
            setImportSetupOpen(true)
          }}
          title="Importar cenários de arquivo Markdown"
        >
          <Upload className="size-4" />
          {isImporting ? "Importando…" : "Importar"}
        </Button>
        <Link href="/cenarios/novo">
          <Button>
            <Plus className="size-4" />
            Adicionar Cenário
          </Button>
        </Link>
      </div>

      {/* ── Table card ── */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar por Código e Cenário"
          activeFilterCount={activeFilterCount}
          onFilterOpen={() => { setPendingFilters(filters); setFilterOpen(true) }}
          totalLabel="Total de cenários"
          totalCount={filtered.length}
          baseCount={sistemaSelecionado ? initialCenarios.filter((c) => c.system === sistemaSelecionado).length : initialCenarios.length}
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
                  <col className="w-36" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-16" />
                  <col className="w-32" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cliente</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Testes</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Erros</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    <th className="sticky right-0 z-20 bg-neutral-grey-50 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr
                      key={c.id}
                      className="group border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                    >
                      {showBulkActions && (
                        <td className="sticky left-0 z-10 bg-surface-card px-4 py-3 group-hover:bg-neutral-grey-50">
                          <Checkbox
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleRow(c.id)}
                          />
                        </td>
                      )}
                      <td className={cn(
                        "sticky z-10 bg-surface-card px-4 py-3 font-medium whitespace-nowrap group-hover:bg-neutral-grey-50",
                        showBulkActions ? "left-10" : "left-0"
                      )}>
                        {c.active ? (
                          <Link href={`/cenarios/${c.id}/editar`} className="font-medium text-brand-primary hover:underline">
                            {c.id}
                          </Link>
                        ) : (
                          <span className="font-medium">{c.id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-0">
                        <span className="block truncate text-text-primary" title={c.scenarioName}>{c.scenarioName}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary truncate" title={c.module}>{c.module}</td>
                      <td className="px-4 py-3 text-text-secondary truncate" title={c.client}>{c.client}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{c.execucoes}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{c.erros}</td>
                      <td className="px-4 py-3">
                        <CenarioTipoBadge tipo={c.tipo as "Automatizado" | "Manual" | "Man./Auto."} />
                      </td>
                      <td className="sticky right-0 z-10 bg-surface-card py-3 pl-2 pr-4 group-hover:bg-neutral-grey-50">
                        {filters.apenasInativos ? (
                          <button
                            type="button"
                            aria-label="Ativar"
                            onClick={() => { setAtivarId(c.id); setAtivarOpen(true) }}
                            className="flex size-8 items-center justify-center rounded-custom text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                          >
                            <RotateCcw className="size-4" />
                          </button>
                        ) : showBulkActions && c.active ? (
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
                                <Link href={`/cenarios/${c.id}/editar`} className="w-full">
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
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Módulo</label>
              <Select
                value={pendingFilters.modulo}
                onValueChange={(v: string | null) =>
                  setPendingFilters((p) => ({ ...p, modulo: v ?? "" }))
                }
                disabled={modulosDosistema.length === 0}
              >
                <SelectTrigger><SelectValue placeholder={modulosDosistema.length === 0 ? "Nenhum módulo cadastrado" : "Todos"} /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {modulosDosistema.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Cliente</label>
              <Select
                value={pendingFilters.cliente}
                onValueChange={(v: string | null) =>
                  setPendingFilters((p) => ({ ...p, cliente: v ?? "" }))
                }
                disabled={clienteNames.length === 0}
              >
                <SelectTrigger><SelectValue placeholder={clienteNames.length === 0 ? "Nenhum cliente cadastrado" : "Todos"} /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Todos</SelectItem>
                  {clienteNames.map((cl) => (
                    <SelectItem key={cl} value={cl}>{cl}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
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
                  <SelectItem value="Automatizado">Automatizado</SelectItem>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Man./Auto.">Man./Auto.</SelectItem>
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

      {/* ── Confirm ativação ── */}
      <ConfirmDialog
        open={ativarOpen}
        onOpenChange={setAtivarOpen}
        title="Deseja ativar?"
        description="Este cadastro voltará a aparecer na listagem de ativos."
        confirmLabel="Ativar"
        onConfirm={handleAtivar}
      />

      {/* ── Import setup modal ── */}
      <Dialog open={importSetupOpen} onOpenChange={setImportSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Cenários</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Sistema</label>
              <Input value={sistemaSelecionado} disabled />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Módulo <span className="text-destructive">*</span>
              </label>
              <Select
                value={importSetupModule}
                onValueChange={(v) => setImportSetupModule(v ?? "")}
                disabled={systemModuleNames.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={systemModuleNames.length === 0 ? "Nenhum módulo cadastrado" : "Selecionar módulo"} />
                </SelectTrigger>
                <SelectPopup>
                  {systemModuleNames.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <p className="text-xs text-text-secondary">Todos os cenários importados serão atribuídos a este módulo.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Arquivo Markdown <span className="text-destructive">*</span>
              </label>
              <input
                ref={setupFileInputRef}
                type="file"
                accept=".md,.markdown"
                className="hidden"
                onChange={(e) => {
                  setImportSetupFile(e.target.files?.[0] ?? null)
                  e.target.value = ""
                }}
              />
              <button
                type="button"
                onClick={() => setupFileInputRef.current?.click()}
                className={`w-full rounded-custom border-2 border-dashed px-4 py-6 text-center transition-colors hover:bg-neutral-grey-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
                  importSetupFile ? "border-brand-primary/40 bg-brand-primary/5" : "border-border-default"
                }`}
              >
                {importSetupFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="size-5 text-brand-primary" />
                    <span className="text-sm font-medium text-brand-primary">{importSetupFile.name}</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="size-6 mx-auto text-text-secondary" />
                    <p className="text-sm text-text-secondary">Clique para selecionar um arquivo <span className="font-medium">.md</span></p>
                  </div>
                )}
              </button>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setImportSetupOpen(false)}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button
              disabled={!importSetupModule || !importSetupFile}
              onClick={handleSetupConfirm}
            >
              <Upload className="size-4" />
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import progress modal ── */}
      <Dialog open={importProgressOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Importando Cenários…</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-text-secondary">
              Importando cenário <span className="font-medium text-text-primary">{importProgress.current}</span> de{" "}
              <span className="font-medium text-text-primary">{importProgress.total}</span>…
            </p>
            <div className="w-full overflow-hidden rounded-full bg-neutral-grey-200 h-2.5">
              <div
                className="h-2.5 rounded-full bg-brand-primary transition-all duration-300 ease-out"
                style={{
                  width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-center text-text-secondary font-medium">
              {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import preview modal ── */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Revisar Cenários — {importSetupModule}</DialogTitle>
          </DialogHeader>

          {/* Summary */}
          {(() => {
            const total = importItems.length
            const newCount = importItems.filter((i) => !i.existing && !i.error).length
            const dupCount = importItems.filter((i) => i.existing && !i.error).length
            const errCount = importItems.filter((i) => i.error).length
            return (
              <p className="text-sm text-text-secondary -mt-1">
                <span className="font-medium text-text-primary">{total}</span> cenário{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""} —{" "}
                <span className="text-green-600 font-medium">{newCount} novo{newCount !== 1 ? "s" : ""}</span>
                {dupCount > 0 && <>, <span className="text-amber-600 font-medium">{dupCount} duplicado{dupCount !== 1 ? "s" : ""}</span></>}
                {errCount > 0 && <>, <span className="text-destructive font-medium">{errCount} com erro</span></>}
              </p>
            )
          })()}

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {importItems.map((item, idx) => {
              const isDup = !!item.existing
              const hasErr = !!item.error
              return (
                <div
                  key={item.key}
                  className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
                    hasErr
                      ? "border-destructive/30 bg-destructive/5"
                      : isDup
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-border-default bg-surface-card"
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      disabled={hasErr}
                      checked={item.include}
                      onChange={() =>
                        setImportItems((prev) =>
                          prev.map((x, i) => i === idx ? { ...x, include: !x.include } : x)
                        )
                      }
                      className="size-4 accent-brand-primary cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {item.parsed.scenarioName}
                      </span>
                      {!hasErr && !isDup && (
                        <span className="shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-full border border-green-600/30 bg-green-600/10 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
                          Novo
                        </span>
                      )}
                      {!hasErr && isDup && !item.replace && (
                        <span className="shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
                          Já existe
                        </span>
                      )}
                      {!hasErr && isDup && item.replace && (
                        <span className="shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
                          <ArrowRightLeft className="size-3" />
                          Substituir
                        </span>
                      )}
                      {hasErr && (
                        <span className="shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600">
                          <AlertCircle className="size-3" />
                          Erro
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      {item.parsed.module && <span>Módulo: <span className="font-medium">{item.parsed.module}</span></span>}
                      {item.parsed.risco && <span>Risco: {item.parsed.risco}</span>}
                      {item.parsed.tipo && <span>Tipo: <span className="font-medium">{item.parsed.tipo}</span></span>}
                    </div>
                    {hasErr && (
                      <p className="text-xs text-destructive">{item.error}</p>
                    )}
                  </div>

                  {/* Compare button */}
                  {isDup && !hasErr && (
                    <button
                      type="button"
                      onClick={() => setCompareItem(item)}
                      className="shrink-0 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20 transition-colors"
                    >
                      <ArrowRightLeft className="size-3.5" />
                      Comparar
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter showCloseButton={false}>
            <div className="flex items-center gap-2 w-full justify-between">
              <button
                type="button"
                onClick={() => {
                  const allSelectable = importItems.filter((i) => !i.error)
                  const allOn = allSelectable.every((i) => i.include)
                  setImportItems((prev) => prev.map((i) => i.error ? i : { ...i, include: !allOn }))
                }}
                className="text-sm text-brand-primary hover:underline"
              >
                {importItems.filter((i) => !i.error).every((i) => i.include) ? "Desmarcar todos" : "Selecionar todos"}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                  <X className="size-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={importItems.filter((i) => i.include && !i.error).length === 0}
                >
                  <Upload className="size-4" />
                  Importar {(() => { const n = importItems.filter((i) => i.include && !i.error).length; return n > 0 ? `(${n})` : "" })()}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Comparison modal ── */}
      <Dialog open={!!compareItem} onOpenChange={(open) => { if (!open) setCompareItem(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Comparar Cenário</DialogTitle>
          </DialogHeader>
          {compareItem && (
            <>
              <p className="text-sm text-text-secondary -mt-1">
                Comparando{" "}
                <span className="font-medium text-text-primary">
                  {"\u201C"}
                  {compareItem.parsed.scenarioName}
                  {"\u201D"}
                </span>{" "}
                do arquivo com o cenário existente <span className="font-medium text-text-primary">{compareItem.existing?.id}</span>.
              </p>
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-neutral-grey-50 z-10">
                    <tr className="border-b border-border-default">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary w-36">Campo</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                        Existente <span className="font-normal text-text-secondary">({compareItem.existing?.id})</span>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                        Importando <span className="font-normal text-text-secondary">(arquivo)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map(({ label, pKey, eKey }) => {
                      const existingVal = String(compareItem.existing?.[eKey] ?? "")
                      const importedVal = String(compareItem.parsed[pKey] ?? "")
                      const isDiff = existingVal !== importedVal
                      return (
                        <tr key={label} className={`border-b border-border-default last:border-0 ${isDiff ? "bg-amber-500/10" : ""}`}>
                          <td className="px-3 py-2 text-xs font-medium text-text-secondary align-top">{label}</td>
                          <td className={`px-3 py-2 text-text-primary align-top whitespace-pre-wrap ${isDiff ? "line-through text-text-secondary" : ""}`}>
                            {existingVal || <span className="text-text-secondary italic">—</span>}
                          </td>
                          <td className={`px-3 py-2 align-top whitespace-pre-wrap ${isDiff ? "text-amber-600 font-medium dark:text-amber-400" : "text-text-primary"}`}>
                            {importedVal || <span className="text-text-secondary italic">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <DialogFooter showCloseButton={false}>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCompareItem(null)}>Fechar</Button>
                  <Button
                    onClick={() => {
                      setImportItems((prev) =>
                        prev.map((x) =>
                          x.key === compareItem.key ? { ...x, replace: true, include: true } : x
                        )
                      )
                      setCompareItem(null)
                    }}
                  >
                    <ArrowRightLeft className="size-4" />
                    Substituir existente
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
