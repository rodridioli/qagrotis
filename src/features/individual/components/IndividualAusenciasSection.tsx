"use client"

import * as React from "react"
import { Check, Loader2, MoreVertical, Plus, Trash2, X } from "lucide-react"
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
import { AusenciaSituacaoBadge, AusenciaTipoBadge } from "@/components/shared/StatusBadge"
import {
  listIndividualAusencias,
  createIndividualAusencias,
  updateIndividualAusencias,
  deleteIndividualAusencias,
  approveIndividualAusencias,
  refuseIndividualAusencias,
  type IndividualAusenciasRow,
  type AusenciaTipo,
} from "@/features/individual/actions/individual-ausencias"
import {
  createAusenciaSchema,
  updateAusenciaSchema,
  refuseAusenciaSchema,
} from "@/features/individual/lib/individual-ausencias-schemas"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoToBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatCodigo(codigo: number): string {
  return `AUS-${String(codigo).padStart(3, "0")}`
}

function formatPeriodo(row: IndividualAusenciasRow): string {
  if (row.diaInteiro) return "Dia todo"
  if (row.horaInicio && row.horaFim) return `Das ${row.horaInicio} às ${row.horaFim}`
  return "Dia todo"
}

function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + "…" : str
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: AusenciaTipo; label: string }[] = [
  { value: "FALTA",       label: "Falta" },
  { value: "BANCO_HORAS", label: "Banco de horas" },
  { value: "ATESTADO",    label: "Atestado" },
  { value: "ATRASO",      label: "Atraso" },
  { value: "OUTRO",       label: "Outro" },
]

// ── Handle type ───────────────────────────────────────────────────────────────

export interface IndividualAusenciasSectionHandle {
  openAdd: () => void
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  tipo: AusenciaTipo | ""
  dataIso: string
  diaInteiro: boolean
  horaInicio: string
  horaFim: string
  justificativa: string
}

const EMPTY_FORM: FormState = {
  tipo: "",
  dataIso: "",
  diaInteiro: true,
  horaInicio: "",
  horaFim: "",
  justificativa: "",
}

// ── Field errors ──────────────────────────────────────────────────────────────

interface FieldErrors {
  tipo?: boolean
  dataIso?: boolean
  horaInicio?: boolean
  horaFim?: boolean
  justificativa?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  evaluatedUserId: string
  canWrite: boolean
}

export const IndividualAusenciasSection = React.forwardRef<
  IndividualAusenciasSectionHandle,
  Props
>(function IndividualAusenciasSection({ evaluatedUserId, canWrite }, ref) {
  const [rows, setRows] = React.useState<IndividualAusenciasRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  // Create/edit modal
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingRow, setEditingRow] = React.useState<IndividualAusenciasRow | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [saving, setSaving] = React.useState(false)

  // Motivo recusa modal (read-only)
  const [motivoOpen, setMotivoOpen] = React.useState(false)
  const [motivoRow, setMotivoRow] = React.useState<IndividualAusenciasRow | null>(null)

  // Recusar modal (MGR)
  const [recusaOpen, setRecusaOpen] = React.useState(false)
  const [recusaRow, setRecusaRow] = React.useState<IndividualAusenciasRow | null>(null)
  const [motivoRecusa, setMotivoRecusa] = React.useState("")
  const [motivoRecusaError, setMotivoRecusaError] = React.useState(false)
  const [savingRecusa, setSavingRecusa] = React.useState(false)

  // Aprovar loading per-row
  const [approvingId, setApprovingId] = React.useState<string | null>(null)

  // Delete
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteRow, setDeleteRow] = React.useState<IndividualAusenciasRow | null>(null)

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
      setRows(await listIndividualAusencias(evaluatedUserId))
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar as ausências.")
    } finally {
      setLoading(false)
    }
  }, [evaluatedUserId])

  React.useEffect(() => { void refetch() }, [refetch])

  // ── Filtered rows ────────────────────────────────────────────────────────────

  const filtered = React.useMemo<IndividualAusenciasRow[]>(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) =>
      formatCodigo(r.codigo).toLowerCase().includes(q) ||
      (r.evaluatedUser?.name ?? "").toLowerCase().includes(q),
    )
  }, [rows, search])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openEdit(row: IndividualAusenciasRow) {
    setEditingRow(row)
    setForm({
      tipo: row.tipo,
      dataIso: row.dataIso,
      diaInteiro: row.diaInteiro,
      horaInicio: row.horaInicio ?? "",
      horaFim: row.horaFim ?? "",
      justificativa: row.justificativa,
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSave() {
    const errs: FieldErrors = {}
    if (!form.tipo) errs.tipo = true
    if (!form.dataIso) errs.dataIso = true
    if (!form.justificativa.trim()) errs.justificativa = true
    if (!form.diaInteiro) {
      if (!form.horaInicio) errs.horaInicio = true
      if (!form.horaFim) errs.horaFim = true
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    const payload = {
      evaluatedUserId,
      tipo: form.tipo as AusenciaTipo,
      dataIso: form.dataIso,
      diaInteiro: form.diaInteiro,
      horaInicio: form.diaInteiro ? null : form.horaInicio || null,
      horaFim: form.diaInteiro ? null : form.horaFim || null,
      justificativa: form.justificativa.trim(),
    }

    // Client-side hora validation
    if (!form.diaInteiro && form.horaInicio && form.horaFim) {
      const toMin = (h: string) => {
        const [hh, mm] = h.split(":").map(Number)
        return (hh ?? 0) * 60 + (mm ?? 0)
      }
      if (toMin(form.horaFim) <= toMin(form.horaInicio)) {
        setFieldErrors((p) => ({ ...p, horaFim: true }))
        toast.error("Hora de término deve ser após a hora de início.")
        return
      }
    }

    setFieldErrors({})
    setSaving(true)
    try {
      if (editingRow) {
        const schema = updateAusenciaSchema
        const parsed = schema.safeParse({ ...payload, id: editingRow.id })
        if (!parsed.success) {
          toast.error("Dados inválidos. Verifique os campos.")
          return
        }
        const res = await updateIndividualAusencias({ ...payload, id: editingRow.id })
        if (res.error) { toast.error(res.error); return }
        toast.success("Ausência atualizada com sucesso.")
      } else {
        const schema = createAusenciaSchema
        const parsed = schema.safeParse(payload)
        if (!parsed.success) {
          toast.error("Dados inválidos. Verifique os campos.")
          return
        }
        const res = await createIndividualAusencias(payload)
        if ("error" in res) { toast.error(res.error); return }
        toast.success("Solicitação enviada para aprovação.")
      }
      setModalOpen(false)
      if (!editingRow) {
        // Don't refetch for create — pending items not shown to non-MGR
        if (canWrite) void refetch()
      } else {
        void refetch()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(row: IndividualAusenciasRow) {
    setApprovingId(row.id)
    try {
      const res = await approveIndividualAusencias(row.id)
      if (res.error) { toast.error(res.error); return }
      toast.success("Ausência aprovada com sucesso.")
      void refetch()
    } finally {
      setApprovingId(null)
    }
  }

  function openRecusa(row: IndividualAusenciasRow) {
    setRecusaRow(row)
    setMotivoRecusa("")
    setMotivoRecusaError(false)
    setRecusaOpen(true)
  }

  async function handleConfirmRecusa() {
    if (!recusaRow) return
    const parsed = refuseAusenciaSchema.safeParse({ id: recusaRow.id, motivoRecusa })
    if (!parsed.success) {
      setMotivoRecusaError(true)
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }
    setMotivoRecusaError(false)
    setSavingRecusa(true)
    try {
      const res = await refuseIndividualAusencias({ id: recusaRow.id, motivoRecusa })
      if (res.error) { toast.error(res.error); return }
      toast.success("Solicitação recusada. O usuário foi notificado.")
      setRecusaOpen(false)
      void refetch()
    } finally {
      setSavingRecusa(false)
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return
    const res = await deleteIndividualAusencias(deleteRow.id)
    if (res.error) { toast.error(res.error); return }
    toast.success("Ausência removida.")
    setDeleteOpen(false)
    setDeleteRow(null)
    void refetch()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            setEditingRow(null)
            setForm(EMPTY_FORM)
            setFieldErrors({})
            setModalOpen(true)
          }}
        >
          <Plus className="size-4" aria-hidden />
          Adicionar Ausência
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por usuário…"
          totalLabel="Total de ausências"
          totalCount={rows.length}
          baseCount={rows.length}
        />

        {error ? (
          <div className="mx-4 my-3 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {loading ? (
          <SectionSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={
              canWrite
                ? "Nenhuma ausência registrada para este usuário."
                : "Nenhuma ausência registrada."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="qagrotis-table-row-hover-muted w-full min-w-[56rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Código</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Usuário</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Tipo</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Data</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Período</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Justificativa</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Situação</th>
                  {canWrite && (
                    <th className="w-28 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const userName = row.evaluatedUser?.name ?? "Usuário"
                  const initials = getInitials(userName)
                  const isPending = row.situacao === "PENDENTE"

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border-default last:border-b-0 transition-colors"
                    >
                      {/* Código */}
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="cursor-pointer font-semibold text-brand-primary tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                            aria-label={`Editar ausência ${formatCodigo(row.codigo)}`}
                          >
                            {formatCodigo(row.codigo)}
                          </button>
                        ) : (
                          <span className="font-semibold tabular-nums text-text-primary">
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

                      {/* Tipo */}
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <AusenciaTipoBadge tipo={row.tipo} />
                      </td>

                      {/* Data */}
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                        {formatIsoToBr(row.dataIso)}
                      </td>

                      {/* Período */}
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary sm:px-4">
                        {formatPeriodo(row)}
                      </td>

                      {/* Justificativa */}
                      <td className="px-3 py-3 text-sm text-text-secondary sm:px-4">
                        <span title={row.justificativa}>{truncate(row.justificativa)}</span>
                      </td>

                      {/* Situação */}
                      <td className="px-3 py-3 sm:px-4">
                        <AusenciaSituacaoBadge
                          situacao={row.situacao}
                          onClick={
                            row.situacao === "RECUSADA"
                              ? () => { setMotivoRow(row); setMotivoOpen(true) }
                              : undefined
                          }
                        />
                      </td>

                      {/* Ações (MGR only) */}
                      {canWrite && (
                        <td className="px-2 py-3 sm:px-3">
                          {isPending ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs border-badge-success bg-badge-success text-white hover:bg-badge-success/88 active:bg-badge-success/95"
                                aria-label={`Aprovar ausência ${formatCodigo(row.codigo)}`}
                                disabled={approvingId === row.id}
                                onClick={() => void handleApprove(row)}
                              >
                                {approvingId === row.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Check className="size-3.5" aria-hidden />
                                )}
                                Aprovar
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="gap-1 text-xs"
                                aria-label={`Recusar ausência ${formatCodigo(row.codigo)}`}
                                disabled={approvingId === row.id}
                                onClick={() => openRecusa(row)}
                              >
                                <X className="size-3.5" aria-hidden />
                                Recusar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <button
                                      type="button"
                                      aria-label={`Ações para ausência ${formatCodigo(row.codigo)}`}
                                      className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                                    />
                                  }
                                >
                                  <MoreVertical className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="bottom">
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => { setDeleteRow(row); setDeleteOpen(true) }}
                                  >
                                    <Trash2 className="size-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
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

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRow ? "Editar ausência" : "Informar ausência"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="aus-tipo">
                Tipo de ausência <span className="text-destructive" aria-hidden>*</span>
              </label>
              <Select
                value={form.tipo}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, tipo: v as AusenciaTipo }))
                  setFieldErrors((p) => ({ ...p, tipo: false }))
                }}
                aria-label="Tipo de ausência"
              >
                <SelectTrigger
                  id="aus-tipo"
                  className={fieldErrors.tipo ? "border-destructive" : ""}
                >
                  <SelectValue>
                    {TIPO_OPTIONS.find((o) => o.value === form.tipo)?.label ?? "Selecione o tipo"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="aus-data">
                Data da ausência <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="aus-data"
                type="date"
                value={form.dataIso}
                onChange={(e) => {
                  setForm((f) => ({ ...f, dataIso: e.target.value }))
                  setFieldErrors((p) => ({ ...p, dataIso: false }))
                }}
                className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.dataIso ? "border-destructive" : "border-border-default"}`}
                style={{ colorScheme: "light" }}
              />
            </div>

            {/* Período */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-text-primary">
                Período <span className="text-destructive" aria-hidden>*</span>
              </span>
              <div role="radiogroup" aria-label="Período" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="aus-periodo"
                    checked={form.diaInteiro}
                    onChange={() => setForm((f) => ({ ...f, diaInteiro: true, horaInicio: "", horaFim: "" }))}
                    className="accent-brand-primary"
                  />
                  Dia todo
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="aus-periodo"
                    checked={!form.diaInteiro}
                    onChange={() => setForm((f) => ({ ...f, diaInteiro: false }))}
                    className="accent-brand-primary"
                  />
                  Parte do dia
                </label>
              </div>

              {/* Hora início e fim — expand quando Parte do dia */}
              {!form.diaInteiro && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-primary" htmlFor="aus-hora-inicio">
                      Hora de início <span className="text-destructive" aria-hidden>*</span>
                    </label>
                    <input
                      id="aus-hora-inicio"
                      type="time"
                      value={form.horaInicio}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, horaInicio: e.target.value }))
                        setFieldErrors((p) => ({ ...p, horaInicio: false }))
                      }}
                      className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.horaInicio ? "border-destructive" : "border-border-default"}`}
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-primary" htmlFor="aus-hora-fim">
                      Hora de término <span className="text-destructive" aria-hidden>*</span>
                    </label>
                    <input
                      id="aus-hora-fim"
                      type="time"
                      value={form.horaFim}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, horaFim: e.target.value }))
                        setFieldErrors((p) => ({ ...p, horaFim: false }))
                      }}
                      className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.horaFim ? "border-destructive" : "border-border-default"}`}
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Justificativa */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="aus-justificativa">
                Justificativa <span className="text-destructive" aria-hidden>*</span>
              </label>
              <textarea
                id="aus-justificativa"
                rows={3}
                value={form.justificativa}
                placeholder="Descreva o motivo da ausência…"
                onChange={(e) => {
                  setForm((f) => ({ ...f, justificativa: e.target.value }))
                  setFieldErrors((p) => ({ ...p, justificativa: false }))
                }}
                className={`w-full rounded-lg border bg-surface-input px-3 py-2 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary resize-none ${fieldErrors.justificativa ? "border-destructive" : "border-border-default"}`}
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
              <X className="size-4 shrink-0" aria-hidden />
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
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  {editingRow ? "Salvando…" : "Enviando…"}
                </>
              ) : (
                <>
                  <Check className="size-4 shrink-0" aria-hidden />
                  {editingRow ? "Salvar alterações" : "Enviar solicitação"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Motivo da recusa modal (read-only) ────────────────────────────────── */}
      <Dialog open={motivoOpen} onOpenChange={setMotivoOpen}>
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Motivo da recusa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {motivoRow?.aprovadoPorId && (
              <p className="text-xs text-text-secondary">
                Recusado por: administrador responsável
              </p>
            )}
            <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-4 py-3 text-sm text-text-secondary">
              {motivoRow?.motivoRecusa ?? "—"}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5 sm:w-auto"
              onClick={() => setMotivoOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Recusar solicitação modal (MGR) ───────────────────────────────────── */}
      <Dialog open={recusaOpen} onOpenChange={setRecusaOpen}>
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Recusar solicitação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-text-secondary">
              Descreva o motivo da recusa. O usuário será notificado com esta mensagem.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="aus-motivo-recusa">
                Motivo <span className="text-destructive" aria-hidden>*</span>
              </label>
              <textarea
                id="aus-motivo-recusa"
                rows={3}
                value={motivoRecusa}
                placeholder="Descreva o motivo da recusa…"
                onChange={(e) => {
                  setMotivoRecusa(e.target.value)
                  setMotivoRecusaError(false)
                }}
                className={`w-full rounded-lg border bg-surface-input px-3 py-2 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary resize-none ${motivoRecusaError ? "border-destructive" : "border-border-default"}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setRecusaOpen(false)}
              disabled={savingRecusa}
            >
              <X className="size-4 shrink-0" aria-hidden />
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              onClick={() => void handleConfirmRecusa()}
              disabled={savingRecusa}
            >
              {savingRecusa ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Recusando…
                </>
              ) : (
                <>
                  <X className="size-4 shrink-0" aria-hidden />
                  Confirmar recusa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir ausência"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        confirmIcon={<Trash2 className="size-4 shrink-0" aria-hidden />}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
})
