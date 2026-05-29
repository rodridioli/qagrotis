"use client"

import * as React from "react"
import { Check, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TablePagination } from "@/components/shared/TablePagination"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { IndividualProgressaoTable } from "@/features/individual/components/IndividualProgressaoTable"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  listProgressoes,
  createProgressao,
  updateProgressao,
  deleteProgressao,
} from "@/features/individual/actions/individual-progressao"
import {
  PROGRESSAO_TIPO_OPTIONS,
  PROGRESSAO_REGIME_OPTIONS,
  type ProgressaoListRow,
  type ProgressaoTipo,
  type ProgressaoRegime,
} from "@/features/individual/lib/individual-progressao"

const PAGE_SIZE = 20

// ── Currency helpers ──────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  if (cents === 0) return ""
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function displayToCents(display: string): number {
  const digits = display.replace(/\D/g, "")
  if (!digits) return 0
  return parseInt(digits, 10)
}

function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ProgressaoFormState {
  data: string
  tipo: ProgressaoTipo | ""
  regime: ProgressaoRegime | ""
  cargo: string
  valorHoraDisplay: string
  valorDisplay: string
}

const EMPTY_FORM: ProgressaoFormState = { data: "", tipo: "", regime: "", cargo: "", valorHoraDisplay: "", valorDisplay: "" }

interface ProgressaoModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  evaluatedUserId: string
  editRow: ProgressaoListRow | null
  onSuccess: () => void
}

function ProgressaoModal({ open, onOpenChange, evaluatedUserId, editRow, onSuccess }: ProgressaoModalProps) {
  const [form, setForm] = React.useState<ProgressaoFormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ProgressaoFormState, string>>>({})

  React.useEffect(() => {
    if (!open) return
    if (editRow) {
      setForm({
        data: editRow.dataYmd,
        tipo: editRow.tipo,
        regime: editRow.regime,
        cargo: editRow.cargo,
        valorHoraDisplay: editRow.valorHora != null ? centsToDisplay(editRow.valorHora) : "",
        valorDisplay: centsToDisplay(editRow.valor),
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [open, editRow])

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.data) e.data = "Data obrigatória."
    if (!form.tipo) e.tipo = "Tipo obrigatório."
    if (!form.regime) e.regime = "Regime obrigatório."
    if (!form.cargo.trim()) e.cargo = "Cargo obrigatório."
    if (displayToCents(form.valorDisplay) <= 0) e.valorDisplay = "Valor obrigatório."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }
    setSaving(true)
    const valorHoraCents = displayToCents(form.valorHoraDisplay)
    const payload = {
      evaluatedUserId,
      data: form.data,
      tipo: form.tipo as ProgressaoTipo,
      regime: form.regime as ProgressaoRegime,
      cargo: form.cargo.trim(),
      valorHora: valorHoraCents > 0 ? valorHoraCents : null,
      valor: displayToCents(form.valorDisplay),
    }
    try {
      const res = editRow
        ? await updateProgressao({ ...payload, id: editRow.id })
        : await createProgressao(payload)
      setSaving(false)
      if (res.error) { toast.error(res.error); return }
      toast.success(editRow ? "Progressão atualizada com sucesso." : "Progressão criada com sucesso.")
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      setSaving(false)
      toast.error(e instanceof Error ? e.message : "Erro interno ao processar progressão.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editRow ? "Editar Progressão" : "Adicionar Progressão"}</DialogTitle>
        </DialogHeader>

        <form id="progressao-form" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-data" className="text-sm font-medium text-text-primary">
                Data <span className="text-destructive">*</span>
              </label>
              <input
                id="prog-data"
                type="date"
                value={form.data}
                onChange={(e) => { setForm((f) => ({ ...f, data: e.target.value })); setErrors(p => ({ ...p, data: "" })) }}
                aria-invalid={!!errors.data}
                className={`h-9 w-full rounded-custom border px-3 text-sm text-text-primary outline-none transition-colors ${
                  errors.data 
                    ? "border-destructive bg-surface-input focus:ring-2 focus:ring-destructive/20" 
                    : "border-border-default bg-surface-input focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                }`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-tipo" className="text-sm font-medium text-text-primary">
                Tipo <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.tipo}
                onValueChange={(v) => { setForm((f) => ({ ...f, tipo: v as ProgressaoTipo })); setErrors(p => ({ ...p, tipo: "" })) }}
              >
                <SelectTrigger id="prog-tipo" aria-label="Tipo de progressão" className={errors.tipo ? "border-destructive ring-2 ring-destructive/20" : ""}>
                  <SelectValue placeholder="Selecione o tipo">
                    {PROGRESSAO_TIPO_OPTIONS.find((o) => o.value === form.tipo)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {PROGRESSAO_TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-regime" className="text-sm font-medium text-text-primary">
                Regime <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.regime}
                onValueChange={(v) => { setForm((f) => ({ ...f, regime: v as ProgressaoRegime })); setErrors(p => ({ ...p, regime: "" })) }}
              >
                <SelectTrigger id="prog-regime" aria-label="Regime de trabalho" className={errors.regime ? "border-destructive ring-2 ring-destructive/20" : ""}>
                  <SelectValue placeholder="Selecione o regime">
                    {PROGRESSAO_REGIME_OPTIONS.find((o) => o.value === form.regime)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {PROGRESSAO_REGIME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-cargo" className="text-sm font-medium text-text-primary">
                Cargo <span className="text-destructive">*</span>
              </label>
              <input
                id="prog-cargo"
                type="text"
                placeholder="Ex.: Analista de QA"
                value={form.cargo}
                onChange={(e) => { setForm((f) => ({ ...f, cargo: e.target.value })); setErrors(p => ({ ...p, cargo: "" })) }}
                aria-invalid={!!errors.cargo}
                className={`h-9 w-full rounded-custom border px-3 text-sm text-text-primary outline-none transition-colors ${
                  errors.cargo
                    ? "border-destructive bg-surface-input focus:ring-2 focus:ring-destructive/20"
                    : "border-border-default bg-surface-input focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-valor-hora" className="text-sm font-medium text-text-primary">
                Valor Hora
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                  R$
                </span>
                <input
                  id="prog-valor-hora"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.valorHoraDisplay}
                  onChange={(e) => { setForm((f) => ({ ...f, valorHoraDisplay: maskCurrency(e.target.value) })) }}
                  className="h-9 w-full rounded-custom border border-border-default bg-surface-input pl-9 pr-3 text-right text-sm text-text-primary tabular-nums outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-valor" className="text-sm font-medium text-text-primary">
                Valor <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                  R$
                </span>
                <input
                  id="prog-valor"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.valorDisplay}
                  onChange={(e) => { setForm((f) => ({ ...f, valorDisplay: maskCurrency(e.target.value) })); setErrors(p => ({ ...p, valorDisplay: "" })) }}
                  aria-invalid={!!errors.valorDisplay}
                  className={`h-9 w-full rounded-custom border pl-9 pr-3 text-right text-sm text-text-primary tabular-nums outline-none transition-colors ${
                    errors.valorDisplay
                      ? "border-destructive bg-surface-input focus:ring-2 focus:ring-destructive/20"
                      : "border-border-default bg-surface-input focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  }`}
                />
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <X className="size-4 shrink-0" />
            Cancelar
          </Button>
          <Button type="submit" form="progressao-form" className="gap-1.5" disabled={saving}>
            <Check className="size-4 shrink-0" />
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Imperative handle ─────────────────────────────────────────────────────────

export interface ProgressaoSectionHandle {
  openAdd: () => void
}

// ── Main section ─────────────────────────────────────────────────────────────

export interface ProgressaoSectionProps {
  evaluatedUserId: string
}

export const ProgressaoSection = React.forwardRef<ProgressaoSectionHandle, ProgressaoSectionProps>(
  function ProgressaoSection({ evaluatedUserId }, ref) {
    const [rows, setRows] = React.useState<ProgressaoListRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)

    const [modalOpen, setModalOpen] = React.useState(false)
    const [editRow, setEditRow] = React.useState<ProgressaoListRow | null>(null)

    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [deleteRow, setDeleteRow] = React.useState<ProgressaoListRow | null>(null)

    React.useImperativeHandle(ref, () => ({
      openAdd() {
        setEditRow(null)
        setModalOpen(true)
      },
    }))

    const refetch = React.useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
        setRows(await listProgressoes(evaluatedUserId))
      } catch (e) {
        setRows([])
        setError(e instanceof Error ? e.message : "Não foi possível carregar as progressões.")
      } finally {
        setLoading(false)
      }
    }, [evaluatedUserId])

    React.useEffect(() => { void refetch() }, [refetch])

    React.useEffect(() => { setPage(1) }, [evaluatedUserId])

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

    React.useEffect(() => {
      setPage((p) => Math.min(p, totalPages))
    }, [totalPages])

    const paginated = React.useMemo(() => {
      const start = (page - 1) * PAGE_SIZE
      return rows.slice(start, start + PAGE_SIZE)
    }, [rows, page])

    async function confirmDelete() {
      if (!deleteRow) return
      const res = await deleteProgressao(deleteRow.id)
      if (res.error) { toast.error(res.error); return }
      toast.success("Progressão removida com sucesso.")
      setDeleteOpen(false)
      setDeleteRow(null)
      void refetch()
    }

    if (loading) return <SectionSpinner minHeight="min-h-[60vh]" />

    return (
      <div className="flex w-full flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            totalLabel="Total de progressões"
            totalCount={rows.length}
            baseCount={0}
          />

          {error ? (
            <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState message="Nenhum registro encontrado." />
          ) : (
            <IndividualProgressaoTable
              rows={paginated}
              onEdit={(row) => { setEditRow(row); setModalOpen(true) }}
              onRequestDelete={(row) => { setDeleteRow(row); setDeleteOpen(true) }}
              footer={
                totalPages > 1 ? (
                  <TablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={rows.length}
                    itemsPerPage={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                ) : null
              }
            />
          )}
        </div>

        <ProgressaoModal
          open={modalOpen}
          onOpenChange={(v) => { setModalOpen(v); if (!v) setEditRow(null) }}
          evaluatedUserId={evaluatedUserId}
          editRow={editRow}
          onSuccess={() => void refetch()}
        />

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Excluir progressão?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          confirmIcon={<Trash2 className="size-4 shrink-0" aria-hidden />}
          onConfirm={() => void confirmDelete()}
        />
      </div>
    )
  },
)
