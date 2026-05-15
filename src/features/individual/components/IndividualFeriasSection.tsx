"use client"

import * as React from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import {
  listIndividualFerias,
  createIndividualFerias,
  updateIndividualFerias,
  deleteIndividualFerias,
  type IndividualFeriasRow,
} from "@/features/individual/actions/individual-ferias"

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── exposed handle (used by IndividualSecaoDevelopmentPanel toolbar button) ───

export interface IndividualFeriasSectionHandle {
  openAdd: () => void
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  evaluatedUserId: string
  canWrite: boolean
}

interface FormState {
  inicioIso: string
  dias: string
}

const EMPTY_FORM: FormState = { inicioIso: "", dias: "" }

export const IndividualFeriasSection = React.forwardRef<IndividualFeriasSectionHandle, Props>(
  function IndividualFeriasSection({ evaluatedUserId, canWrite }, ref) {
    const [rows, setRows] = React.useState<IndividualFeriasRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    // Modal state
    const [modalOpen, setModalOpen] = React.useState(false)
    const [editingRow, setEditingRow] = React.useState<IndividualFeriasRow | null>(null)
    const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
    const [saving, setSaving] = React.useState(false)
    const [formError, setFormError] = React.useState<string | null>(null)

    // Delete state
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [deleteRow, setDeleteRow] = React.useState<IndividualFeriasRow | null>(null)

    React.useImperativeHandle(ref, () => ({
      openAdd: () => {
        setEditingRow(null)
        setForm(EMPTY_FORM)
        setFormError(null)
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
      setFormError(null)
      setModalOpen(true)
    }

    async function handleSave() {
      setFormError(null)
      if (!form.inicioIso) { setFormError("Início das Férias é obrigatório."); return }
      const dias = parseInt(form.dias, 10)
      if (!form.dias || isNaN(dias) || dias < 1) { setFormError("Dias de Férias deve ser no mínimo 1."); return }

      setSaving(true)
      try {
        if (editingRow) {
          const res = await updateIndividualFerias({ id: editingRow.id, inicioIso: form.inicioIso, dias })
          if ("error" in res && res.error) { setFormError(res.error); return }
          toast.success("Férias atualizadas com sucesso.")
        } else {
          const res = await createIndividualFerias({ evaluatedUserId, inicioIso: form.inicioIso, dias })
          if ("error" in res) { setFormError(res.error); return }
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

    return (
      <div className="flex w-full flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <p className="text-sm font-medium text-text-secondary">
              Total de férias:{" "}
              <span className="font-semibold text-text-primary">{loading ? "—" : rows.length}</span>
            </p>
          </div>

          {error ? (
            <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading ? (
            <SectionSpinner />
          ) : rows.length === 0 ? (
            <EmptyState message="Nenhum registro encontrado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-raised">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Início</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Dias</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Retorno</th>
                    {canWrite && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {rows.map((row) => {
                    const retornoIso = calcRetornoIso(row.inicioIso, row.dias)
                    return (
                      <tr key={row.id} className="hover:bg-surface-raised/50">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-medium text-text-primary tabular-nums">
                          {formatCodigo(row.codigo)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary tabular-nums">
                          {formatIsoToBr(row.inicioIso)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary tabular-nums">
                          {row.dias}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary tabular-nums">
                          {formatIsoToBr(retornoIso)}
                        </td>
                        {canWrite && (
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Editar"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Excluir"
                                onClick={() => { setDeleteRow(row); setDeleteOpen(true) }}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
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
                  onChange={(e) => setForm((f) => ({ ...f, inicioIso: e.target.value }))}
                  className="flex h-9 w-full rounded-lg border border-border-default bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
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
                  onChange={(e) => setForm((f) => ({ ...f, dias: e.target.value }))}
                  className="flex h-9 w-full rounded-lg border border-border-default bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>

              {formError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Salvando…" : editingRow ? "Salvar" : "Cadastrar"}
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
  }
)
