"use client"

import * as React from "react"
import { Check, Loader2, MoreVertical, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { FeriasSituacaoBadge, type FeriasSituacao } from "@/components/shared/StatusBadge"
import {
  listIndividualFerias,
  createIndividualFerias,
  updateIndividualFerias,
  deleteIndividualFerias,
  type IndividualFeriasRow,
} from "@/features/individual/actions/individual-ferias"

// ── Types ─────────────────────────────────────────────────────────────────────

type SituacaoFiltro = "ativas" | "planejada" | "em_andamento" | "concluida" | "todas"

type RowWithSituacao = IndividualFeriasRow & { situacao: FeriasSituacao }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoToBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function calcRetornoIso(inicioIso: string, dias: number): string {
  const d = new Date(inicioIso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function formatCodigo(codigo: number): string {
  return `FER-${String(codigo).padStart(3, "0")}`
}

function computeSituacao(inicioIso: string, dias: number): FeriasSituacao {
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const [y, m, d] = inicioIso.split("-").map(Number)
  const inicioUtc = Date.UTC(y!, m! - 1, d!)
  const retornoUtc = inicioUtc + dias * 86400000
  if (inicioUtc > todayUtc) return "planejada"
  if (retornoUtc > todayUtc) return "em_andamento"
  return "concluida"
}

function matchesSituacaoFiltro(situacao: FeriasSituacao, filtro: SituacaoFiltro): boolean {
  if (filtro === "todas") return true
  if (filtro === "ativas") return situacao === "planejada" || situacao === "em_andamento"
  return situacao === filtro
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SITUACAO_OPTIONS: { value: SituacaoFiltro; label: string }[] = [
  { value: "todas",        label: "Todas" },
  { value: "planejada",    label: "Planejada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida",    label: "Concluída" },
]

// ── Handle type ───────────────────────────────────────────────────────────────

export interface IndividualFeriasSectionHandle {
  openAdd: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  evaluatedUserId: string
  canWrite: boolean
  defaultSituacaoFiltro?: SituacaoFiltro
}

interface FormState {
  inicioIso: string
  dias: string
}

const EMPTY_FORM: FormState = { inicioIso: "", dias: "" }

export const IndividualFeriasSection = React.forwardRef<IndividualFeriasSectionHandle, Props>(
  function IndividualFeriasSection({ evaluatedUserId, canWrite, defaultSituacaoFiltro = "ativas" }, ref) {
    const [rows, setRows] = React.useState<IndividualFeriasRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [situacaoFiltro, setSituacaoFiltro] = React.useState<SituacaoFiltro>(defaultSituacaoFiltro)
    const [filterOpen, setFilterOpen] = React.useState(false)
    const [filterDraft, setFilterDraft] = React.useState<SituacaoFiltro>(defaultSituacaoFiltro)

    // Modal state
    const [modalOpen, setModalOpen] = React.useState(false)
    const [editingRow, setEditingRow] = React.useState<IndividualFeriasRow | null>(null)
    const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
    const [saving, setSaving] = React.useState(false)
    const [fieldErrors, setFieldErrors] = React.useState<{ inicioIso?: boolean; dias?: boolean }>({})

    // Delete state
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [deleteRow, setDeleteRow] = React.useState<IndividualFeriasRow | null>(null)

    React.useImperativeHandle(ref, () => ({
      openAdd: () => {
        setEditingRow(null)
        setForm(EMPTY_FORM)
        setFieldErrors({})
        setModalOpen(true)
      },
    }))

    const refetch = React.useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await listIndividualFerias(evaluatedUserId)
        setRows(list)
      } catch (e) {
        setRows([])
        setError(e instanceof Error ? e.message : "Não foi possível carregar as férias.")
      } finally {
        setLoading(false)
      }
    }, [evaluatedUserId])

    React.useEffect(() => {
      void refetch()
    }, [refetch])

    function openEdit(row: IndividualFeriasRow) {
      setEditingRow(row)
      setForm({ inicioIso: row.inicioIso, dias: String(row.dias) })
      setFieldErrors({})
      setModalOpen(true)
    }

    async function handleSave() {
      const dias = parseInt(form.dias, 10)
      const e: typeof fieldErrors = {}
      if (!form.inicioIso) e.inicioIso = true
      if (!form.dias || isNaN(dias) || dias < 1) e.dias = true
      if (Object.keys(e).length > 0) {
        setFieldErrors(e)
        toast.error("Preencha todos os campos obrigatórios.")
        return
      }
      setFieldErrors({})
      setSaving(true)
      try {
        if (editingRow) {
          const res = await updateIndividualFerias({ id: editingRow.id, inicioIso: form.inicioIso, dias })
          if ("error" in res && res.error) { toast.error(res.error); return }
          toast.success("Férias atualizadas com sucesso.")
        } else {
          const res = await createIndividualFerias({ evaluatedUserId, inicioIso: form.inicioIso, dias })
          if ("error" in res) { toast.error(res.error); return }
          toast.success("Férias cadastradas com sucesso.")
        }
        setModalOpen(false)
        void refetch()
      } finally {
        setSaving(false)
      }
    }

    async function confirmDelete() {
      if (!deleteRow) return
      const res = await deleteIndividualFerias(deleteRow.id)
      if (res.error) { toast.error(res.error); return }
      toast.success("Férias removidas com sucesso.")
      setDeleteOpen(false)
      setDeleteRow(null)
      void refetch()
    }

    const rowsWithSituacao = React.useMemo<RowWithSituacao[]>(
      () => rows.map((r) => ({ ...r, situacao: computeSituacao(r.inicioIso, r.dias) })),
      [rows],
    )

    const filtered = React.useMemo<RowWithSituacao[]>(() => {
      return rowsWithSituacao.filter((r) => {
        if (!matchesSituacaoFiltro(r.situacao, situacaoFiltro)) return false
        if (!search.trim()) return true
        const q = search.trim().toLowerCase()
        return (
          formatCodigo(r.codigo).toLowerCase().includes(q) ||
          formatIsoToBr(r.inicioIso).includes(q) ||
          (r.evaluatedUser?.name ?? "").toLowerCase().includes(q)
        )
      })
    }, [rowsWithSituacao, situacaoFiltro, search])

    const activeFilterCount = situacaoFiltro !== defaultSituacaoFiltro ? 1 : 0

    return (
      <div className="flex w-full flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por usuário…"
            totalLabel="Total de férias"
            totalCount={rows.length}
            baseCount={rows.length}
            activeFilterCount={activeFilterCount}
            onFilterOpen={() => {
              setFilterDraft(situacaoFiltro)
              setFilterOpen(true)
            }}
          />

          {error ? (
            <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading ? (
            <SectionSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum registro encontrado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="qagrotis-table-row-hover-muted w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Código</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Usuário</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Início</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Dias</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Retorno</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Situação</th>
                    {canWrite && (
                      <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const retornoIso = calcRetornoIso(row.inicioIso, row.dias)
                    const userName = row.evaluatedUser?.name ?? "Usuário"
                    const initials = getInitials(userName)
                    return (
                      <tr key={row.id} className="border-b border-border-default last:border-b-0 transition-colors">
                        {/* Código */}
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="cursor-pointer font-semibold text-brand-primary tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                              aria-label={`Abrir férias ${formatCodigo(row.codigo)}`}
                            >
                              {formatCodigo(row.codigo)}
                            </button>
                          ) : (
                            <span className="font-semibold text-brand-primary tabular-nums">
                              {formatCodigo(row.codigo)}
                            </span>
                          )}
                        </td>
                        {/* Usuário */}
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              {row.evaluatedUser?.photoPath ? (
                                <AvatarImage src={row.evaluatedUser.photoPath} alt={userName} />
                              ) : null}
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-text-primary">{userName}</span>
                          </div>
                        </td>
                        {/* Início */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                          {formatIsoToBr(row.inicioIso)}
                        </td>
                        {/* Dias */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                          {row.dias}
                        </td>
                        {/* Retorno */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                          {formatIsoToBr(retornoIso)}
                        </td>
                        {/* Situação */}
                        <td className="px-3 py-3 sm:px-4">
                          <FeriasSituacaoBadge situacao={row.situacao} />
                        </td>
                        {/* Ações */}
                        {canWrite && (
                          <td className="px-2 py-3 text-center sm:px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    aria-label="Mais ações"
                                    className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                                  />
                                }
                              >
                                <MoreVertical className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="bottom">
                                <DropdownMenuItem onClick={() => openEdit(row)}>
                                  <Pencil className="size-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => { setDeleteRow(row); setDeleteOpen(true) }}
                                >
                                  <Trash2 className="size-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Filter dialog */}
        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent showCloseButton className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Situação</label>
                <Select
                  value={filterDraft}
                  onValueChange={(v) => setFilterDraft(v as SituacaoFiltro)}
                  aria-label="Filtrar por situação"
                >
                  <SelectTrigger>
                    <SelectValue>
                      {SITUACAO_OPTIONS.find((o) => o.value === filterDraft)?.label ?? "Selecione..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {SITUACAO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSituacaoFiltro(defaultSituacaoFiltro)
                  setFilterDraft(defaultSituacaoFiltro)
                  setFilterOpen(false)
                }}
              >
                Limpar filtros
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => setFilterOpen(false)}
              >
                <X className="size-4 shrink-0" />
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => {
                  setSituacaoFiltro(filterDraft)
                  setFilterOpen(false)
                }}
              >
                <Check className="size-4 shrink-0" />
                Filtrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create / Edit modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent showCloseButton className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRow ? "Editar Férias" : "Adicionar Férias"}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary" htmlFor="ferias-inicio">
                  Início das Férias <span className="text-destructive">*</span>
                </label>
                <input
                  id="ferias-inicio"
                  type="date"
                  value={form.inicioIso}
                  onChange={(e) => { setForm((f) => ({ ...f, inicioIso: e.target.value })); setFieldErrors((p) => ({ ...p, inicioIso: false })) }}
                  className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.inicioIso ? "border-destructive" : "border-border-default"}`}
                  style={{ colorScheme: "light" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary" htmlFor="ferias-dias">
                  Dias de Férias <span className="text-destructive">*</span>
                </label>
                <input
                  id="ferias-dias"
                  type="number"
                  min={1}
                  value={form.dias}
                  onChange={(e) => { setForm((f) => ({ ...f, dias: e.target.value })); setFieldErrors((p) => ({ ...p, dias: false })) }}
                  className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.dias ? "border-destructive" : "border-border-default"}`}
                />
              </div>

            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                <X className="size-4 shrink-0" />
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Check className="size-4 shrink-0" />
                    Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Excluir férias?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          confirmIcon={<Trash2 className="size-4 shrink-0" aria-hidden />}
          onConfirm={() => void confirmDelete()}
        />
      </div>
    )
  },
)
